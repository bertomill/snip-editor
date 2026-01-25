import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { feedback, type, email } = await request.json();

    if (!feedback || !feedback.trim()) {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the current user (optional - feedback can be anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // Insert feedback into the database
    const { error } = await supabase.from('feedback').insert({
      user_id: user?.id || null,
      email: email || user?.email || null,
      feedback: feedback.trim(),
      type: type || 'general',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error inserting feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
