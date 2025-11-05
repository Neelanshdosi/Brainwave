import { NextRequest, NextResponse } from 'next/server';

interface SummarizeRequest {
  url: string;
  title: string;
  description?: string;
}

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

async function fetchArticleContent(articleUrl: string): Promise<string | null> {
  try {
    // For NewsAPI articles, we'll use the description
    // Fetching full article content would require web scraping which is complex
    console.log('📄 Using article description for summary');
    return null; // Will use description passed in request
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

async function generateSummary(content: string, title: string): Promise<string> {
  console.log('🔑 API Key exists:', !!HUGGINGFACE_API_KEY);
  
  if (!HUGGINGFACE_API_KEY) {
    // Return content as-is if no API key
    return content.substring(0, 200) + '...';
  }

  if (content.length < 100) {
    return content;
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
        inputs: content,
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
      
      if (response.status === 503) {
        console.log('⏳ Model loading, using fallback...');
        return content.substring(0, 200) + '...';
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Received summary data');
    
    if (Array.isArray(data) && data[0]?.summary_text) {
      return data[0].summary_text;
    } else if (data.summary_text) {
      return data.summary_text;
    }
    
    return content.substring(0, 200) + '...';
    
  } catch (error) {
    console.error('❌ Summary generation error:', error);
    return content.substring(0, 200) + '...';
  }
}

export async function POST(request: NextRequest) {
  console.log('📨 Received summarize request');
  
  try {
    const body: SummarizeRequest = await request.json();
    const { url, title, description } = body;
    
    console.log('📋 Request:', { url, title });

    // Use description as content
    const content = description || title;
    
    if (!content) {
      return NextResponse.json({ 
        summary: `Breaking news: ${title}`,
        success: true 
      });
    }

    // Generate AI summary
    const summary = await generateSummary(content, title);
    
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