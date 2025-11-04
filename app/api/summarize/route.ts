import { NextRequest, NextResponse } from 'next/server';

interface SummarizeRequest {
  url: string; // Reddit post URL
  title: string;
}

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

// Fetch actual Reddit post content
async function fetchRedditPostContent(postUrl: string): Promise<string | null> {
  try {
    // Convert Reddit URL to JSON endpoint
    const jsonUrl = `https://www.reddit.com${postUrl}.json`;
    
    console.log('📡 Fetching post content from:', jsonUrl);
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Brainwave/1.0',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Reddit post');
      return null;
    }

    const data = await response.json();
    
    // Reddit returns an array: [post_data, comments_data]
    const postData = data[0]?.data?.children?.[0]?.data;
    
    if (!postData) {
      return null;
    }

    // Extract content based on post type
    let content = '';
    
    // Self text posts (text posts)
    if (postData.selftext && postData.selftext.length > 50) {
      content = postData.selftext;
    }
    // Link posts - use title + domain info
    else if (postData.url && !postData.is_self) {
      content = `${postData.title}. This is a link post to ${postData.domain}.`;
    }
    // Image/video posts
    else if (postData.post_hint === 'image' || postData.post_hint === 'hosted:video') {
      content = `${postData.title}. This is a ${postData.post_hint === 'image' ? 'image' : 'video'} post.`;
    }
    // Fallback to title
    else {
      content = postData.title;
    }

    // Also grab top comments for context (first 3)
    const comments = data[1]?.data?.children
      ?.filter((c: any) => c.kind === 't1' && c.data.body) // Filter actual comments
      ?.slice(0, 3) // Top 3
      ?.map((c: any) => c.data.body)
      ?.join(' ') || '';

    // Combine post content with top comments for better context
    const fullContext = `${content} ${comments}`.substring(0, 1500);
    
    console.log('✅ Extracted content length:', fullContext.length);
    
    return fullContext;
    
  } catch (error) {
    console.error('Error fetching Reddit post content:', error);
    return null;
  }
}

async function generateSummary(postContent: string, title: string): Promise<string> {
  console.log('🔑 API Key exists:', !!HUGGINGFACE_API_KEY);
  
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key not configured');
  }

  // If content is too short, just use a simple explanation
  if (postContent.length < 100) {
    return `This post titled "${title}" is trending on Reddit.`;
  }

  try {
    console.log('📤 Sending to Hugging Face for summarization...');

    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: postContent,
        parameters: {
          max_length: 130,
          min_length: 40,
          do_sample: false,
        },
      }),
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Hugging Face API error:', error);
      
      // If model is loading (503), wait and retry once
      if (response.status === 503) {
        console.log('⏳ Model loading, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Retry once
        const retryResponse = await fetch(MODEL_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: postContent,
            parameters: { max_length: 130, min_length: 40, do_sample: false },
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          return extractSummaryFromResponse(retryData);
        }
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Received summary data');
    
    return extractSummaryFromResponse(data);
    
  } catch (error) {
    console.error('❌ Summary generation error:', error);
    // Return first 150 chars of content as fallback
    return postContent.substring(0, 150) + '...';
  }
}

function extractSummaryFromResponse(data: any): string {
  if (Array.isArray(data) && data[0]?.summary_text) {
    return data[0].summary_text;
  } else if (data.summary_text) {
    return data.summary_text;
  } else if (typeof data === 'string') {
    return data;
  }
  throw new Error('Unexpected response format');
}

export async function POST(request: NextRequest) {
  console.log('📨 Received summarize request');
  
  try {
    const body: SummarizeRequest = await request.json();
    const { url, title } = body;
    
    console.log('📋 Request:', { url, title });

    // Fetch actual post content from Reddit
    const postContent = await fetchRedditPostContent(url);
    
    if (!postContent) {
      console.log('⚠️ Could not fetch post content, using title only');
      return NextResponse.json({ 
        summary: `This post titled "${title}" is currently trending on Reddit.`,
        success: true 
      });
    }

    // Generate AI summary from actual content
    const summary = await generateSummary(postContent, title);
    
    console.log('✅ Summary generated successfully');

    return NextResponse.json({ 
      summary: summary,
      success: true 
    });

  } catch (error) {
    console.error('❌ Summarize API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate summary',
        success: false 
      },
      { status: 500 }
    );
  }
}