import "dotenv/config";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import os from "os";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

function list_files({ directory }) {
  if (!fs.existsSync(directory)) return `Directory not found: ${directory}`;
  
  const items = fs.readdirSync(directory).filter((f) => {
    const fullPath = path.join(directory, f);
    return fs.statSync(fullPath).isFile(); 
  });

  return items.length > 0 ? items.join("\n") : "No files found.";
}

function create_folder({ folder_path }) {
  if (fs.existsSync(folder_path)) return `Folder already exists: ${folder_path}`;
  fs.mkdirSync(folder_path, { recursive: true });
  return `Created folder: ${folder_path}`;
}

function move_file({ source, destination }) {
  if (!fs.existsSync(source)) return `Source file not found: ${source}`;

  if (fs.existsSync(destination)) {
    const ext = path.extname(destination);
    const base = destination.slice(0, -ext.length);
    destination = `${base}_${Date.now()}${ext}`;
  }

  fs.renameSync(source, destination);
  return `Moved: ${path.basename(source)} → ${destination}`;
}

function write_report({ report_path, content }) {
  fs.writeFileSync(report_path, content);
  return `Report saved to: ${report_path}`;
}

const toolFunctions = { list_files, create_folder, move_file, write_report };

const tools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files in a directory",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Path to the directory" },
        },
        required: ["directory"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Create a new subfolder inside the target directory",
      parameters: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Full path of folder to create" },
        },
        required: ["folder_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Move a file from source to destination",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Current full path of the file" },
          destination: { type: "string", description: "Destination full path" },
        },
        required: ["source", "destination"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_report",
      description: "Write a text report summarizing what was done",
      parameters: {
        type: "object",
        properties: {
          report_path: { type: "string", description: "Full path to save the report" },
          content: { type: "string", description: "Report content" },
        },
        required: ["report_path", "content"],
      },
    },
  },
];

async function runAgent(targetDirectory) {
  console.log(`\n🤖 Starting agent on: ${targetDirectory}\n`);

  const messages = [
    {
      role: "system",
      content: `You are a file organization agent. When given a folder to organize:
1. First list the files to see what's there
2. Group similar file types and create appropriate subfolders (e.g. Images, Documents, Videos, Audio, Code, Archives, Spreadsheets, Other)
3. Move each file into the right subfolder
4. Only create folders that are actually needed based on what files exist
5. Never move or delete folders, only files
6. Finally write a report called organization_report.txt in the target folder summarizing what you did
Be systematic. Think before acting.`,
    },
    {
      role: "user",
      content: `Please organize the files in this folder: ${targetDirectory}`,
    },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 4096,
      tools,
      messages,
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`\n✅ Done!\n`);
      console.log(message.content);
      break;
    }

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      console.log(`\n🔧 ${name}`);
      console.log(`   →`, args);

      const result = toolFunctions[name](args);
      console.log(`   ✓`, result);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: String(result),
      });
    }
  }
}

const desktopPath = "C:\\Users\\Hp\\OneDrive\\Desktop";
await runAgent(desktopPath);