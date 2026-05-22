import { generateCaption } from '../config/groq.js';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── POST /api/ai/generate-caption ─────────────────────────────────────────────
export const generatePostCaption = async (req, res) => {
  try {
    const { description, mood } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required to generate a caption' });
    }

    const moodText = mood ? ` Mood: ${mood}.` : '';
    const prompt = `Generate an Instagram caption for a photo of: ${description.trim()}.${moodText} Include 3-5 relevant hashtags.`;

    const caption = await generateCaption(prompt);
    return res.status(200).json({ caption });
  } catch (error) {
    console.error('generatePostCaption error:', error.message);
    return res.status(500).json({ message: 'AI service unavailable' });
  }
};

// ── POST /api/ai/suggestions ──────────────────────────────────────────────────
export const getAISuggestions = async (req, res) => {
  try {
    const { type, context } = req.body;

    if (!type || !context) {
      return res.status(400).json({ message: 'Type and context are required' });
    }

    let prompt;
    switch (type) {
      case 'caption':
        prompt = `Generate 3 different Instagram caption options for: ${context}`;
        break;
      case 'hashtags':
        prompt = `Generate 15 relevant Instagram hashtags for: ${context}`;
        break;
      case 'bio':
        prompt = `Write a creative Instagram bio for someone who: ${context}. Max 150 characters.`;
        break;
      default:
        return res.status(400).json({ message: 'Invalid type. Use: caption, hashtags, or bio' });
    }

    const suggestions = await generateCaption(prompt);
    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('getAISuggestions error:', error.message);
    return res.status(500).json({ message: 'AI service unavailable' });
  }
};

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
export const aiChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are InstaClone AI assistant. Help users with content creation, captions, hashtags, and social media tips.',
      },
      // Append conversation history
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message.trim(),
      },
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      max_tokens: 500,
      messages,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '';
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('aiChat error:', error.message);
    return res.status(500).json({ message: 'AI service unavailable' });
  }
};
