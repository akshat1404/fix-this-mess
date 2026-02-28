# fix-this-mess

A command line tool that uses AI to automatically organize messy folders.

Point it at any folder and it will sort your files into subfolders by type — Images, Documents, Videos, Audio, Code, Archives — and generate a report of everything it did.

Powered by Groq and Llama 4.

## Setup

1. Clone the repo
2. Run `npm install`
3. Get a free API key at https://console.groq.com/keys
4. Create a `.env` file and add `GROQ_API_KEY=your_key_here`

## Usage
```bash
node index.js
```

Type a folder name when prompted:
- `desktop` — organizes your Desktop
- `downloads` — organizes your Downloads
- `documents` — organizes your Documents
- Or paste any full folder path

## Note
Always check your Recycle Bin if something goes missing. OneDrive paths can sometimes behave unexpectedly.
