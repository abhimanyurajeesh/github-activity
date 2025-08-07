import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, activityTypes, startDate, endDate, state = "all", githubToken } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Owner and repository are required" }, { status: 400 });
    }

    const headers: { [key: string]: string } = {
      Accept: "application/vnd.github.v3+json",
    };

    if (githubToken) {
      headers["Authorization"] = `token ${githubToken}`;
    }

    const allData: any[] = [];

    // Fetch different types of activity
    for (const activityType of activityTypes) {
      try {
        let url = "";
        const params = new URLSearchParams();

        switch (activityType) {
          case "pull_requests":
            url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
            // For PRs, we need to handle merged state differently
            if (state === "merged") {
              params.set("state", "closed");
            } else {
              params.set("state", state === "all" ? "all" : state);
            }
            params.set("per_page", "100");
            break;

          case "issues":
            url = `https://api.github.com/repos/${owner}/${repo}/issues`;
            params.set("state", state === "all" ? "all" : state);
            params.set("per_page", "100");
            break;

          case "commits":
            url = `https://api.github.com/repos/${owner}/${repo}/commits`;
            params.set("since", startDate);
            params.set("until", endDate);
            params.set("per_page", "100");
            break;

          case "releases":
            url = `https://api.github.com/repos/${owner}/${repo}/releases`;
            params.set("per_page", "100");
            break;

          case "discussions":
            url = `https://api.github.com/repos/${owner}/${repo}/discussions`;
            params.set("per_page", "100");
            break;

          default:
            continue;
        }

        const response = await fetch(`${url}?${params.toString()}`, { headers });

        if (!response.ok) {
          if (activityType === "discussions" && response.status === 404) {
            // Discussions might not be enabled for this repository
            continue;
          }
          throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Add type identifier to each item
        const typedData = data.map((item: any) => ({
          ...item,
          type: activityType,
        }));

        allData.push(...typedData);
      } catch (error: any) {
        console.error(`Error fetching ${activityType}:`, error);
        // Continue with other activity types even if one fails
      }
    }

    // Apply date range filter
    let filteredData = allData;

    if (startDate && endDate) {
      filteredData = filteredData.filter((item: any) => {
        const itemDate = item.created_at || item.commit?.author?.date;
        if (!itemDate) return false;

        const date = new Date(itemDate);
        const start = new Date(startDate);
        const end = new Date(endDate);

        return date >= start && date <= end;
      });
    }

    // Filter for merged PRs if state is "merged"
    if (state === "merged") {
      filteredData = filteredData.filter((item: any) => {
        // For pull requests, check if they have a merged_at date
        if (item.type === "pull_requests") {
          return item.merged_at != null;
        }
        // For issues, merged state doesn't apply
        return false;
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      total: filteredData.length,
      repository: `${owner}/${repo}`,
    });
  } catch (error: any) {
    console.error("GitHub Activity API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
