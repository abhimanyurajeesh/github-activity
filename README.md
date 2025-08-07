# GitHub Activity Report

A comprehensive tool for generating GitHub activity reports and downloading repository activity data with customizable filters.

## Features

### 1. Activity Report Generator
- Generate EOD (End of Day) reports from your GitHub activity
- Track pull requests, issues, commits, and more
- Customizable date ranges and organization filters
- Export reports in markdown format

### 2. Activity Downloader (New!)
- Download repository activity data with customizable filters
- Support for multiple activity types: Pull Requests, Issues, Commits, Releases, Discussions
- Filter by date range, authors, labels, and state
- Export in CSV, JSON, or Excel formats
- Real-time progress tracking during downloads

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd github-activity
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Activity Report Generator

1. **Enter GitHub Username**: Enter your GitHub username to fetch your activity
2. **Select Organization**: Choose an organization to filter activity (optional)
3. **Set Date Range**: Select the time period for your activity report
4. **Configure Settings**: Add your GitHub token for private repository access
5. **Generate Report**: Click "Fetch" to generate your activity timeline
6. **Customize EOD**: Select which activities to include in your EOD report
7. **Export**: Copy the generated markdown report

### Activity Downloader

1. **Enter Repository**: Enter a repository URL or owner/repo format (e.g., `ohcnetwork/care_fe`)
2. **Set Date Range**: Choose the time period for activity data
3. **Select Activity Types**: Choose which types of activity to download:
   - Pull Requests
   - Issues
   - Commits
   - Releases
   - Discussions
4. **Apply Filters**: Filter by state, authors, and labels
5. **Choose Format**: Select CSV, JSON, or Excel format
6. **Download**: Click "Download Activity" to get your data

## Supported Repository Formats

The downloader supports various repository input formats:
- Full URL: `https://github.com/ohcnetwork/care_fe`
- Owner/Repo: `ohcnetwork/care_fe`
- Any public or private repository (with GitHub token)

## GitHub Token Setup

For enhanced functionality and access to private repositories:

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with appropriate permissions:
   - `repo` (for private repositories)
   - `read:org` (for organization access)
3. Copy the token and paste it in the settings modal
4. The token will be saved locally for future use

## API Endpoints

### `/api/github-activity`
POST endpoint for fetching repository activity data.

**Request Body:**
```json
{
  "owner": "string",
  "repo": "string", 
  "activityTypes": ["pull_requests", "issues", "commits"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "state": "all|open|closed",
  "authors": ["username1", "username2"],
  "labels": ["label1", "label2"],
  "githubToken": "optional_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 42,
  "repository": "owner/repo"
}
```

## Technologies Used

- **Next.js 14** - React framework
- **Ant Design** - UI components
- **Day.js** - Date manipulation
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.