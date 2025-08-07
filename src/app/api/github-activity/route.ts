import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, startDate, endDate, state = "merged", githubToken } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Owner and repository are required" }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
    }

    // Set GitHub token if provided
    if (githubToken) {
      process.env.GITHUB_TOKEN = githubToken;
    }

    // Try GitHub CLI first, then fallback to GitHub API
    let data = [];
    let useFallback = false;

    try {
      // First, let's test if we can access the repository
      console.log("Testing repository access...");
      const testCommand = `gh repo view ${owner}/${repo} --json name,description`;

      try {
        await execAsync(testCommand);
        console.log("Repository access successful");
      } catch (testError: any) {
        console.error("Repository access failed:", testError.message);
        useFallback = true;
      }

      if (!useFallback) {
        // Construct the GitHub CLI command - simplified version
        const command = `gh pr list --repo ${owner}/${repo} --state ${state} --json number,title,state,author,createdAt,mergedAt,labels,assignees,url --limit 100`;

        console.log("Executing command:", command);

        // Add timeout to prevent hanging
        const { stdout, stderr } = (await Promise.race([
          execAsync(command),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Command timeout after 30 seconds")), 30000)),
        ])) as { stdout: string; stderr: string };

        console.log("Command stdout length:", stdout.length);
        console.log("Command stderr:", stderr);

        if (stderr && !stderr.includes("warning")) {
          console.warn("GitHub CLI stderr:", stderr);
        }

        if (stdout.trim()) {
          try {
            data = JSON.parse(stdout);
            console.log("Successfully parsed JSON, found", data.length, "pull requests");
          } catch (parseError) {
            console.error("Failed to parse JSON output:", parseError);
            console.log("Raw stdout (first 500 chars):", stdout.substring(0, 500));
            useFallback = true;
          }
        } else {
          console.log("No stdout received from command");
          useFallback = true;
        }
      }
    } catch (execError: any) {
      console.error("GitHub CLI execution error:", execError);
      useFallback = true;
    }

    // Fallback to GitHub API if CLI failed
    if (useFallback || data.length === 0) {
      console.log("Using GitHub API fallback...");

      const headers: { [key: string]: string } = {
        Accept: "application/vnd.github.v3+json",
      };

      if (githubToken) {
        headers["Authorization"] = `token ${githubToken}`;
      }

      const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
      const params = new URLSearchParams();
      params.set("state", state === "merged" ? "closed" : state);
      params.set("per_page", "100");

      const response = await fetch(`${url}?${params.toString()}`, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
      }

      const apiData = await response.json();

      // Filter for merged PRs if state is "merged"
      if (state === "merged") {
        data = apiData.filter((item: any) => item.merged_at != null);
      } else {
        data = apiData;
      }

      console.log("GitHub API fallback found", data.length, "pull requests");
    }

    // Filter by date range if needed
    let filteredData = data;
    if (startDate && endDate) {
      filteredData = data.filter((item: any) => {
        if (!item.mergedAt && !item.merged_at) return false;
        const mergedDate = new Date(item.mergedAt || item.merged_at);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return mergedDate >= start && mergedDate <= end;
      });
      console.log("Filtered to", filteredData.length, "PRs in date range");
    }

    // Transform the data to match the expected format
    const transformedData = filteredData.map((item: any) => ({
      number: item.number,
      title: item.title,
      type: "pull_requests",
      state: item.state,
      author: item.author?.login || item.user?.login || "",
      created_at: item.createdAt || item.created_at,
      merged_at: item.mergedAt || item.merged_at,
      labels: item.labels?.map((l: any) => l.name).join(", ") || "",
      assignees: item.assignees?.map((a: any) => a.login).join(", ") || "",
      html_url: item.url || item.html_url,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
      repository: `${owner}/${repo}`,
    });
  } catch (error: any) {
    console.error("GitHub Activity API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
