# Snip Transcribe Lambda

AWS Lambda function for video transcription with FFmpeg and Groq Whisper. This bypasses Vercel's serverless function limitations by using Lambda with FFmpeg layer.

## Deployment

### 1. Install Dependencies

```bash
cd worker/transcribe-lambda
npm install
```

### 2. Create Lambda Deployment Package

```bash
zip -r transcribe-lambda.zip index.js package.json node_modules/
```

### 3. Create Lambda Function

1. Go to AWS Lambda Console
2. Create new function:
   - **Name**: `snip-transcribe`
   - **Runtime**: Node.js 18.x or 20.x
   - **Architecture**: x86_64
3. Upload the `transcribe-lambda.zip` file

### 4. Add FFmpeg Layer

Add an FFmpeg layer to your Lambda. Options:

- **Public layer**: Search for "ffmpeg" in AWS Lambda Layers
- **Custom layer**: Use https://github.com/serverlesspub/ffmpeg-aws-lambda-layer

Example layer ARN (us-east-1):
```
arn:aws:lambda:us-east-1:xxxxxxxxxxxx:layer:ffmpeg:1
```

### 5. Configure Lambda

**Environment Variables:**
- `GROQ_API_KEY`: Your Groq API key
- `FFMPEG_PATH`: `/opt/bin/ffmpeg` (if using layer)

**General Configuration:**
- Memory: 1024 MB (minimum)
- Timeout: 300 seconds (5 minutes)
- Ephemeral storage: 512 MB

### 6. Enable Function URL

1. Go to Function URL in Configuration tab
2. Create Function URL with:
   - Auth type: NONE (or IAM if you prefer)
   - CORS: Enable
   - Allow origin: `*` (or your domain)
   - Allow methods: POST, OPTIONS
   - Allow headers: Content-Type

### 7. Set Environment Variable in Snip

Add to your `.env.local`:

```
LAMBDA_TRANSCRIBE_URL=https://xxxxxxxxxx.lambda-url.us-east-1.on.aws/
```

## API

### Request

```json
POST /
{
  "videoUrl": "https://signed-url-to-video.mp4",
  "detectSilence": true,
  "silenceAggressiveness": "natural"
}
```

### Response

```json
{
  "transcript": "Full transcript text...",
  "segments": [
    { "text": "Segment text", "start": 0.0, "end": 2.5 }
  ],
  "words": [
    { "id": "word-0", "text": "Hello", "start": 0.0, "end": 0.3 }
  ],
  "silenceSegments": [
    { "id": "silence-0", "start": 2.5, "end": 3.0, "duration": 0.5 }
  ],
  "totalSilenceDuration": 5.2,
  "audioDuration": 120.5
}
```

## Testing

```bash
curl -X POST https://your-lambda-url/ \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://example.com/video.mp4"}'
```
