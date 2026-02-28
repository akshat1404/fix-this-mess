import "dotenv/config";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

if (!process.env.GROQ_API_KEY) {
  console.log("GROQ_API_KEY is missing.");
  console.log("Get your free API key at: https://console.groq.com/keys");
  console.log("Then create a .env file and add: GROQ_API_KEY=your_key_here");
  process.exit(1);
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function resolvePath(input) {
  const lower = input.toLowerCase();

  const shortcuts = {
    desktop: [
      path.join(os.homedir(), "OneDrive", "Desktop"),
      path.join(os.homedir(), "Desktop"),
    ],
    downloads: [path.join(os.homedir(), "Downloads")],
    documents: [path.join(os.homedir(), "Documents")],
    pictures: [path.join(os.homedir(), "Pictures")],
    videos: [path.join(os.homedir(), "Videos")],
    music: [path.join(os.homedir(), "Music")],
  };

  if (shortcuts[lower]) {
    for (const p of shortcuts[lower]) {
      if (fs.existsSync(p)) return p;
    }
  }

  if (fs.existsSync(input)) return input;

  const onOneDriveDesktop = path.join(os.homedir(), "OneDrive", "Desktop", input);
  if (fs.existsSync(onOneDriveDesktop)) return onOneDriveDesktop;

  const onDesktop = path.join(os.homedir(), "Desktop", input);
  if (fs.existsSync(onDesktop)) return onDesktop;

  const inHome = path.join(os.homedir(), input);
  if (fs.existsSync(inHome)) return inHome;

  return null;
}

function list_files({ directory }) {
  if (!fs.existsSync(directory)) return `Directory not found: ${directory}`;
  const items = fs.readdirSync(directory).filter((f) => {
    return fs.statSync(path.join(directory, f)).isFile();
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
  return `Moved: ${path.basename(source)} -> ${destination}`;
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
          directory: { type: "string" },
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
          folder_path: { type: "string" },
        },
        required: ["folder_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Move a file from source path to destination path",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string" },
          destination: { type: "string" },
        },
        required: ["source", "destination"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_report",
      description: "Write a summary report of what was done",
      parameters: {
        type: "object",
        properties: {
          report_path: { type: "string" },
          content: { type: "string" },
        },
        required: ["report_path", "content"],
      },
    },
  },
];

async function runAgent(targetDirectory) {
  console.log(`\nStarting agent on: ${targetDirectory}\n`);

  const messages = [
    {
      role: "system",
      content: `You are a file organization agent. When given a folder to organize:
1. First list the files to see what is there
2. Group similar file types and create appropriate subfolders such as Images, Documents, Videos, Audio, Code, Archives, Spreadsheets, Other
3. Move each file into the right subfolder
4. Only create folders that are actually needed based on what files exist
5. Never move or delete folders, only files
6. Finally write a report called organization_report.txt in the target folder summarizing what you did`,
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
      console.log("\nDone!\n");
      console.log(message.content);
      break;
    }

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      console.log(`\n[${name}]`);
      console.log("input:", args);

      const result = toolFunctions[name](args);
      console.log("result:", result);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: String(result),
      });
    }
  }
}

async function main() {
  console.log("Folder Organizer AI");
  console.log("-------------------");
  console.log("Type a folder name like: desktop, downloads, documents");
  console.log("Or type a full path like: C:\\Users\\Hp\\OneDrive\\Desktop\\my-folder\n");

  const input = await askQuestion("Which folder do you want to organize? ");

  const resolvedPath = resolvePath(input);

  if (!resolvedPath) {
    console.log(`Could not find folder: "${input}"`);
    console.log("Make sure the folder exists and try again.");
    process.exit(1);
  }

  console.log(`\nFound folder: ${resolvedPath}`);
  const confirm = await askQuestion("Proceed with organizing this folder? (yes/no) ");

  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("\nNo problem. Please provide the full path to the exact folder you want.\n");
    const fullPathInput = await askQuestion("Enter full folder path: ");
  
    if (!fs.existsSync(fullPathInput)) {
      console.log(`Could not find folder: "${fullPathInput}"`);
      process.exit(1);
    }
  
    const confirmFull = await askQuestion(`Organize "${fullPathInput}"? (yes/no) `);
    if (confirmFull.toLowerCase() !== "yes" && confirmFull.toLowerCase() !== "y") {
      console.log("Cancelled.");
      process.exit(0);
    }
  
    await runAgent(fullPathInput);
    return;
  }

  await runAgent(resolvedPath);
}

main();