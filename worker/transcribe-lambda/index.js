/**
 * AWS Lambda function for video transcription
 *
 * This Lambda function extracts audio from video files and sends them to Groq Whisper
 * for transcription. It requires:
 * - FFmpeg layer (arn:aws:lambda:us-east-1:XXXXXXXX:layer:ffmpeg:1)
 * - Node.js 18+ runtime
 * - GROQ_API_KEY environment variable
 * - 512MB+ memory, 5 minute timeout
 *
 * Deploy with:
 * - Attach FFmpeg layer (e.g., https://github.com/serverlesspub/ffmpeg-aws-lambda-layer)
 * - Set memory to 1024MB
 * - Set timeout to 300 seconds
 * - Enable Function URL with CORS
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Download file from URL to temp directory
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Extract audio from video using FFmpeg
 */
function extractAudio(inputPath, outputPath) {
  // Use ffmpeg from layer or system
  const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';

  const cmd = `${ffmpegPath} -i "${inputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -q:a 2 -y "${outputPath}"`;

  console.log(`Extracting audio: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

/**
 * Detect silence in audio using FFmpeg
 */
function detectSilence(audioPath, options = {}) {
  const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
  const {
    silenceThreshold = -35,
    minSilenceDuration = 0.3,
  } = options;

  try {
    const cmd = `${ffmpegPath} -i "${audioPath}" -af "silencedetect=noise=${silenceThreshold}dB:d=${minSilenceDuration}" -f null - 2>&1`;
    const output = execSync(cmd, { encoding: 'utf8' });

    const segments = [];
    const lines = output.split('\n');
    let currentStart = null;

    for (const line of lines) {
      const startMatch = line.match(/silence_start: ([\d.]+)/);
      const endMatch = line.match(/silence_end: ([\d.]+)/);

      if (startMatch) {
        currentStart = parseFloat(startMatch[1]);
      }
      if (endMatch && currentStart !== null) {
        segments.push({
          id: `silence-${segments.length}`,
          start: currentStart,
          end: parseFloat(endMatch[1]),
          duration: parseFloat(endMatch[1]) - currentStart,
          type: 'silence'
        });
        currentStart = null;
      }
    }

    // Get audio duration
    const durationCmd = `${ffmpegPath} -i "${audioPath}" 2>&1 | grep "Duration"`;
    const durationOutput = execSync(durationCmd, { encoding: 'utf8', shell: true });
    const durationMatch = durationOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    let audioDuration = 0;
    if (durationMatch) {
      audioDuration = parseInt(durationMatch[1]) * 3600 +
                      parseInt(durationMatch[2]) * 60 +
                      parseFloat(durationMatch[3]);
    }

    return { segments, audioDuration };
  } catch (error) {
    console.error('Silence detection failed:', error);
    return { segments: [], audioDuration: 0 };
  }
}

/**
 * Send audio to Groq Whisper for transcription
 */
async function transcribeWithGroq(audioBuffer, apiKey) {
  const FormData = require('form-data');
  const form = new FormData();

  form.append('file', audioBuffer, {
    filename: 'audio.mp3',
    contentType: 'audio/mpeg'
  });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  form.append('language', 'en');

  return new Promise((resolve, reject) => {
    const req = https.request(GROQ_API_URL, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Groq API error: ${res.statusCode} - ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Groq response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

/**
 * Group words into segments
 */
function groupWordsIntoSegments(words) {
  const segments = [];
  let currentSegment = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentSegment.push(word);

    const endsWithPunctuation = /[.!?]$/.test(word.word);
    const nextWord = words[i + 1];
    const hasLongPause = nextWord && (nextWord.start - word.end) > 0.5;
    const segmentTooLong = currentSegment.length >= 15;

    if (endsWithPunctuation || hasLongPause || segmentTooLong || i === words.length - 1) {
      if (currentSegment.length > 0) {
        segments.push({
          text: currentSegment.map(w => w.word).join(' '),
          start: currentSegment[0].start,
          end: currentSegment[currentSegment.length - 1].end
        });
        currentSegment = [];
      }
    }
  }

  return segments;
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  const tmpDir = '/tmp';
  let videoPath = null;
  let audioPath = null;

  try {
    console.log('Lambda transcribe handler invoked');

    // Parse request body
    let body;
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      body = event;
    }

    const { videoUrl, detectSilence: enableSilenceDetection = true } = body;

    if (!videoUrl) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No videoUrl provided' })
      };
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
      };
    }

    // Download video
    const videoId = Date.now();
    videoPath = path.join(tmpDir, `video-${videoId}.mp4`);
    audioPath = path.join(tmpDir, `audio-${videoId}.mp3`);

    console.log(`Downloading video from: ${videoUrl}`);
    await downloadFile(videoUrl, videoPath);

    const videoStats = fs.statSync(videoPath);
    console.log(`Downloaded video: ${(videoStats.size / 1024 / 1024).toFixed(2)}MB`);

    // Extract audio
    console.log('Extracting audio...');
    extractAudio(videoPath, audioPath);

    const audioStats = fs.statSync(audioPath);
    console.log(`Extracted audio: ${(audioStats.size / 1024 / 1024).toFixed(2)}MB`);

    // Check audio size (Groq limit is 25MB)
    if (audioStats.size > 25 * 1024 * 1024) {
      throw new Error(`Audio file too large (${(audioStats.size / 1024 / 1024).toFixed(2)} MB). Maximum is 25MB.`);
    }

    // Detect silence (optional)
    let silenceData = { segments: [], audioDuration: 0 };
    if (enableSilenceDetection) {
      console.log('Detecting silence...');
      silenceData = detectSilence(audioPath);
      console.log(`Found ${silenceData.segments.length} silence segments`);
    }

    // Transcribe with Groq
    console.log('Sending to Groq Whisper...');
    const audioBuffer = fs.readFileSync(audioPath);
    const transcription = await transcribeWithGroq(audioBuffer, groqApiKey);

    console.log(`Transcription complete: ${transcription.text?.substring(0, 100)}...`);

    // Process response
    let segments = [];
    if (transcription.segments && transcription.segments.length > 0) {
      segments = transcription.segments.map(seg => ({
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end
      }));
    } else if (transcription.words && transcription.words.length > 0) {
      segments = groupWordsIntoSegments(transcription.words);
    } else {
      segments = [{ text: transcription.text, start: 0, end: 0 }];
    }

    // Format words with unique IDs
    const words = (transcription.words || []).map((w, i) => ({
      id: `word-${i}`,
      text: w.word,
      start: w.start,
      end: w.end
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        transcript: transcription.text,
        segments,
        words,
        silenceSegments: silenceData.segments,
        totalSilenceDuration: silenceData.segments.reduce((acc, s) => acc + s.duration, 0),
        audioDuration: silenceData.audioDuration
      })
    };

  } catch (error) {
    console.error('Transcription error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Transcription failed',
        details: error.message
      })
    };
  } finally {
    // Cleanup temp files
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
};
