import { config } from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY is missing from .env file");
  process.exit(1);
}

console.log(`✅ Found API Key: ${apiKey.substring(0, 5)}...`);

async function testGemini() {
  try {
    console.log("Connecting to Gemini API...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = "Hello! Are you working? Reply with a short 'Yes, I am online!' message.";
    
    console.log(`Sending prompt: "${prompt}"`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("\n🎉 SUCCESS! Gemini responded:");
    console.log("------------------------------------------------");
    console.log(text);
    console.log("------------------------------------------------");
    console.log("API Key is VALID and working correctly.");

  } catch (error) {
    console.error("\n❌ API TEST FAILED");
    console.error("Error details:", error.message);
    if (error.message.includes("404")) {
      console.error("Hint: The model 'gemini-pro' might not be available in your region or for this key.");
    } else if (error.message.includes("403") || error.message.includes("key")) {
      console.error("Hint: Your API Key might be invalid or has expired.");
    }
  }
}

testGemini();
