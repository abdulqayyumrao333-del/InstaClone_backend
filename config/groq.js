import 'dotenv/config';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate an AI caption using the Groq LLM.
 * @param {string} prompt - The user-supplied context/description
 * @returns {Promise<string>} - The generated caption text
 */
export const generateCaption = async (prompt) => {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You are a creative social media assistant. Generate short, engaging Instagram captions with relevant hashtags.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Groq API error:', error.message);
    throw new Error('AI caption generation failed');
  }
};

export default groq;
