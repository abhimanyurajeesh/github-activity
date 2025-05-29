"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Divider,
  Input,
  Select,
  Space,
  Timeline,
  notification,
  Tooltip,
  Typography,
  Modal,
} from "antd";
import Icon, {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  InfoCircleTwoTone,
  LoadingOutlined,
  QuestionCircleTwoTone,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import Title from "antd/es/typography/Title";
import Paragraph from "antd/es/typography/Paragraph";
import { GithubPRIcon, GithubIssueIcon, GithubAssignIcon } from "./GithubIcons";
import { CheckboxValueType } from "antd/es/checkbox/Group";
import { CheckboxChangeEvent } from "antd/es/checkbox";
import MarkdownPreview from "@uiw/react-markdown-preview";
import TextArea from "antd/es/input/TextArea";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const rangePresets: {
  label: string;
  value: [Dayjs, Dayjs];
}[] = [
  { label: "Last 1 Day", value: [dayjs().add(-1, "d"), dayjs()] },
  { label: "Last 7 Days", value: [dayjs().add(-7, "d"), dayjs()] },
  { label: "Last 14 Days", value: [dayjs().add(-30, "d"), dayjs()] },
  { label: "Last 90 Days", value: [dayjs().add(-90, "d"), dayjs()] },
];

type NotificationType = "success" | "info" | "warning" | "error";

const EOD_TEMPLATE = `**EOD {{DATE}}** @{{ORGANIZATION}}

**How did the day go?**
{{TODAY_ACTIVITIES}}

**What's next?**
{{TOMORROW_ACTIVITIES}}`;

export default function Home() {
  const [api, contextHolder] = notification.useNotification();

  const notify = (type: NotificationType, message: string, description: string) => {
    api[type]({
      message,
      description,
      duration: 3,
    });
  };

  const [usernameField, setUsernameField] = useState({
    value: "",
    error: "",
    state: "empty",
  });

  const [dateField, setDateField] = useState({
    value: {
      startDate: "",
      endDate: "",
    },
    error: "",
  });

  const [orgFilter, setOrgFilter] = useState<{
    list: { login: string }[];
    value: string;
    error: string;
  }>({
    list: [],
    value: "",
    error: "",
  });

  const [repoFilter, setRepoFilter] = useState<{
    list: { name: string }[];
    value: string;
    error: string;
  }>({
    list: [],
    value: "",
    error: "",
  });

  const [branchFilter, setBranchFilter] = useState<{
    list: { name: string }[];
    value: string;
    error: string;
  }>({
    list: [],
    value: "",
    error: "",
  });

  const [activity, setActivity] = useState({
    prs: [],
    issues_created: [],
    issues_assigned: [],
    merged: [],
    commits: [],
    prs_merged: [],
    error: "",
  });

  const includeInEOD = ["Pull Requests Created", "Issues Created", "Issues Assigned", "Commits Made", "PRs Merged"];
  const EODSettings = ["Group by day", "Group by week"];
  const CheckboxGroup = Checkbox.Group;
  const [checkedList, setCheckedList] = useState<CheckboxValueType[]>(includeInEOD);
  const [eodSettingsCheckedList, setEodSettingsCheckedList] = useState<CheckboxValueType[]>([]);
  const [indeterminate, setIndeterminate] = useState(false);
  const [checkAll, setCheckAll] = useState(true);
  const [showFetchSettings, setShowFetchSettings] = useState(false);
  const [showEODSettings, setShowEODSettings] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [settings, setSettings] = useState({
    fetchGithubToken: githubTokenInput,
    splitByDay: false,
    splitByWeek: false,
  });

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const ghfetch = async (url: string) => {
    const headers: { [key: string]: string } = {};
    if (settings.fetchGithubToken) {
      headers["Authorization"] = `token ${settings.fetchGithubToken}`;
      headers["Accept"] = "application/vnd.github.v3+json";
      console.log("Making request to:", url);
    }
    const res = await fetch(url, {
      headers,
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`GitHub API Error: ${errorData.message}`);
    }
    const data = await res.json();
    console.log("Response data:", data);
    return data;
  };

  useEffect(() => {
    const githubToken = localStorage.getItem("githubToken");
    if (githubToken) {
      setGithubTokenInput(githubToken);
      setSettings({
        ...settings,
        fetchGithubToken: githubToken,
      });
    }
    async function prefill() {
      if (searchParams.get("username")) {
        const username = searchParams.get("username") ?? "";
        setUsernameField({
          ...usernameField,
          value: username,
        });
        const org = searchParams.get("org") ?? "";
        await checkGithubUsername(username, org);
      }
      if (searchParams.get("days")) {
        const days = parseInt(searchParams.get("days") ?? "0");
        setDateField({
          ...dateField,
          value: {
            startDate: dayjs().add(-days, "d").toISOString(),
            endDate: dayjs().toISOString(),
          },
        });
      }
    }
    prefill();
  }, []);

  const onChange = (list: CheckboxValueType[]) => {
    setCheckedList(list);
    setIndeterminate(!!list.length && list.length < includeInEOD.length);
    setCheckAll(list.length === includeInEOD.length);
  };

  const onEodSettingChange = (list: CheckboxValueType[]) => {
    setEodSettingsCheckedList(list);
  };

  const onCheckAllChange = (e: CheckboxChangeEvent) => {
    setCheckedList(e.target.checked ? includeInEOD : []);
    setIndeterminate(false);
    setCheckAll(e.target.checked);
  };

  const saveFetchSettings = () => {
    const token = githubTokenInput.trim();
    if (!token) {
      notify("error", "Invalid Token", "Please enter a valid GitHub token");
      return;
    }

    setSettings({
      ...settings,
      fetchGithubToken: token,
    });
    localStorage.setItem("githubToken", token);
    setShowFetchSettings(false);

    // Recheck username if it exists
    if (usernameField.value) {
      setTimeout(() => {
        checkGithubUsername(usernameField.value);
      }, 100);
    }
  };

  const saveEODSettings = () => {
    setSettings({
      ...settings,
      splitByDay: eodSettingsCheckedList.includes("Group by day"),
      splitByWeek: eodSettingsCheckedList.includes("Group by week"),
    });
    setShowEODSettings(false);
  };

  const [fetchBtnState, setFetchBtnState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const onRangeChange = (dates: null | (Dayjs | null)[]) => {
    if (dates) {
      if (dates[0]?.isAfter(dates[1])) {
        setDateField({
          ...dateField,
          error: "Start date should be before end date",
        });
        return;
      }
      setDateField({
        ...dateField,
        error: "",
        value: {
          startDate: dates[0]?.toISOString() ?? "",
          endDate: dates[1]?.toISOString() ?? "",
        },
      });
    } else {
      setDateField({
        ...dateField,
        error: "Date range is required",
      });
    }
  };

  const [EODMessage, setEODMessage] = useState("");

  const checkGithubUsername = async (username: string, defaultOrg = "") => {
    if (!username) {
      setUsernameField({
        ...usernameField,
        error: "",
        value: username,
        state: "empty",
      });
      return false;
    }
    setUsernameField({
      ...usernameField,
      value: username,
      state: "checking",
    });
    try {
      // Try to get user's public organizations first
      const publicOrgsRes = await ghfetch(`https://api.github.com/users/${username}/orgs`);
      let orgList = publicOrgsRes.map((org: { login: string }) => ({ login: org.login }));

      // If we have a token, try to get private organizations too
      if (settings.fetchGithubToken) {
        try {
          const privateOrgsRes = await ghfetch(`https://api.github.com/user/orgs`);
          if (Array.isArray(privateOrgsRes)) {
            // Merge and deduplicate organizations
            const allOrgs = [...orgList, ...privateOrgsRes];
            orgList = Array.from(new Set(allOrgs.map((org) => org.login))).map((login) => ({ login }));
          }
        } catch (error) {
          console.log("Could not fetch private organizations:", error);
          // Continue with public orgs only
        }
      }

      if (defaultOrg && orgList.find((org: { login: string }) => org.login === defaultOrg)) {
        setOrgFilter({
          value: defaultOrg,
          list: orgList,
          error: "",
        });
      } else {
        setOrgFilter({
          value: "",
          list: orgList,
          error: "",
        });
      }

      setUsernameField({
        ...usernameField,
        value: username,
        error: "",
        state: "checked",
      });

      notify("success", "User Found", `Found ${orgList.length} organizations`);
      return true;
    } catch (error: any) {
      console.error("GitHub API Error:", error);
      notify("error", "Error", `Failed to fetch user data: ${error.message}`);
      setUsernameField({
        ...usernameField,
        value: username,
        error: error.message,
        state: "checked",
      });
    }
    return false;
  };

  const fetchRepositories = async (org: string) => {
    try {
      const repoRes = await ghfetch(`https://api.github.com/orgs/${org}/repos`);
      setRepoFilter({
        value: "",
        list: repoRes.map((repo: { name: string }) => ({ name: repo.name })),
        error: "",
      });
      setBranchFilter({
        value: "",
        list: [],
        error: "",
      });
    } catch (error: any) {
      notify("error", "Error", "Something went wrong while fetching repositories: " + error.message);
    }
  };

  const fetchBranches = async (org: string, repo: string) => {
    try {
      const branchRes = await ghfetch(`https://api.github.com/repos/${org}/${repo}/branches`);
      setBranchFilter({
        value: "",
        list: branchRes.map((branch: { name: string }) => ({ name: branch.name })),
        error: "",
      });
    } catch (error: any) {
      notify("error", "Error", "Something went wrong while fetching branches: " + error.message);
    }
  };

  async function getLinkedPRs(issue_url: string) {
    if (!issue_url) return [];
    const linkedPRQuery = await fetch("/api/linkedprs", {
      method: "POST",
      body: JSON.stringify({
        url: issue_url,
      }),
    });
    const linkedPRRes = await linkedPRQuery.json();
    return linkedPRRes;
  }

  async function fetchGithubStats() {
    if (!usernameField.value) {
      setUsernameField({
        ...usernameField,
        error: "Username is required",
      });
      return;
    }
    if (!dateField.value.startDate || !dateField.value.endDate) {
      setDateField({
        ...dateField,
        error: "Date range is required",
      });
      return;
    }
    if (usernameField.error || dateField.error) {
      setFetchBtnState("error");
      return;
    }

    notify("info", "Fetching", "Fetching GitHub stats");
    const params = new URLSearchParams(searchParams.toString());
    const numDays = dayjs(dateField.value.endDate).diff(dayjs(dateField.value.startDate), "day");
    params.set("username", usernameField.value);
    params.set("org", orgFilter.value);
    params.set("days", numDays.toString());
    replace(`${pathname}?${params.toString()}`);
    setFetchBtnState("loading");
    let orgFilterQuery = "";
    if (orgFilter.value) {
      orgFilterQuery = `+org:${orgFilter.value}`;
    }
    try {
      // Use search API for public data which doesn't require authentication
      const issuesData = await ghfetch(
        `https://api.github.com/search/issues?q=author:${usernameField.value}+is:issue+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );

      for (const issue of issuesData.items) {
        issue.type = "issue-created";
      }

      const prData = await ghfetch(
        `https://api.github.com/search/issues?q=author:${usernameField.value}+is:pr+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );

      for (const pr of prData.items) {
        pr.type = "pr-created";
      }

      // Fetch merged PRs
      const mergedPRData = await ghfetch(
        `https://api.github.com/search/issues?q=author:${usernameField.value}+is:pr+is:merged+merged:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );

      for (const pr of mergedPRData.items) {
        pr.type = "pr-merged";
      }

      const issuesAssignedData = await ghfetch(
        `https://api.github.com/search/issues?q=assignee:${usernameField.value}+is:issue+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );

      for (const issue of issuesAssignedData.items) {
        issue.type = "issue-assigned";
      }

      const assignedIssues: any = [];

      for (const issue of issuesAssignedData.items) {
        const eventsRes = await ghfetch(issue.events_url);

        for (const event of eventsRes) {
          if (
            event.event === "assigned" &&
            event.assignee?.login?.toLowerCase() === usernameField.value.toLowerCase()
          ) {
            assignedIssues.push({
              ...issue,
              assigned_at: event.created_at,
              linked_pr: await getLinkedPRs(issue.html_url),
            });
            break;
          }
        }
      }

      // Use search API for commits
      const commitsUrl = `https://api.github.com/search/commits?q=author:${usernameField.value}+committer-date:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`;

      const commitsData = await ghfetch(commitsUrl);
      const myCommits = (commitsData.items || []).filter(
        (commit: any) => commit.committer?.login?.toLowerCase() === usernameField.value.toLowerCase()
      );
      const commits: any = [];

      for (const commit of myCommits) {
        const commit_message_lines = commit.commit.message.split("\n");
        commit.type = "commit-created";
        commit.title = commit_message_lines[0];
        commit.created_at = commit.commit.committer.date;
        const linkedPRs = await ghfetch(commit.url + "/pulls");
        let isLinkedPRPresent = false;
        for (const linkedPR of linkedPRs) {
          for (const pr of prData.items) {
            if (linkedPR.node_id === pr.node_id) {
              isLinkedPRPresent = true;
              break;
            }
          }
        }
        if (!isLinkedPRPresent) commits.push(commit);
      }

      const mergedTimeline: any = [
        ...issuesData.items,
        ...prData.items,
        ...mergedPRData.items,
        ...assignedIssues,
        ...commits,
      ].sort(
        (
          a: { created_at: string; assigned_at?: string; merged_at?: string },
          b: { created_at: string; assigned_at?: string; merged_at?: string }
        ) =>
          dayjs(a.merged_at || a.assigned_at || a.created_at).isAfter(
            dayjs(b.merged_at || b.assigned_at || b.created_at)
          )
            ? -1
            : 1
      );

      setActivity({
        prs: prData.items,
        issues_created: issuesData.items,
        issues_assigned: assignedIssues,
        merged: mergedTimeline,
        commits: commits,
        prs_merged: mergedPRData.items,
        error: "",
      });
      setFetchBtnState("success");

      if (!settings.fetchGithubToken) {
        notify(
          "info",
          "Limited Access",
          "Using public data only. Add a GitHub token to see private repositories and organizations."
        );
      }
    } catch (error: any) {
      notify("error", "Error", "Something went wrong while fetching your GitHub stats: " + error.message);
      setFetchBtnState("error");
    }
  }

  function getTimelineDot(type: string) {
    switch (type) {
      case "issue-created":
        return (
          <Tooltip title="Issue Created">
            <InfoCircleTwoTone twoToneColor="#52c41a" />
          </Tooltip>
        );
      case "issue-assigned":
        return (
          <Tooltip title="Issue Assigned">
            <Icon component={GithubAssignIcon} />
          </Tooltip>
        );
      case "pr-created":
        return (
          <Tooltip title="Pull Request Created">
            <Icon component={GithubPRIcon} />
          </Tooltip>
        );
      case "pr-merged":
        return (
          <Tooltip title="Pull Request Merged">
            <CheckCircleTwoTone twoToneColor="#722ed1" />
          </Tooltip>
        );
      case "commit-created":
        return (
          <Tooltip title="Commit Created">
            <Icon component={GithubIssueIcon} />
          </Tooltip>
        );
      default:
        return (
          <Tooltip title="Unknown Action">
            <QuestionCircleTwoTone twoToneColor="#8c8c8c" />
          </Tooltip>
        );
    }
  }

  function getRepoName(url: string) {
    return url.replace("https://github.com/", "")?.split("/")?.[1] || "";
  }

  function getRepoNameFromUrl(url: string | undefined): string {
    if (!url) return "";
    const parts = url.split("/");
    if (url.includes("/repos/")) {
      const repoIndex = parts.indexOf("repos");
      if (repoIndex >= 0 && parts.length > repoIndex + 2) {
        return parts[repoIndex + 2];
      }
    }
    // For html_urls
    if (url.includes("github.com/")) {
      const githubIndex = parts.indexOf("github.com");
      if (githubIndex >= 0 && parts.length > githubIndex + 2) {
        return parts[githubIndex + 2];
      }
    }
    return "";
  }

  function getEODMessage() {
    let eodMessage = EOD_TEMPLATE;
    if (dayjs(dateField.value.startDate).format("YYYY-MM-DD") === dayjs(dateField.value.endDate).format("YYYY-MM-DD"))
      eodMessage = eodMessage.replace("{{DATE}}", dayjs(dateField.value.startDate).format("DD/MM/YYYY"));
    else
      eodMessage = eodMessage.replace(
        "{{DATE}}",
        dayjs(dateField.value.startDate).format("DD/MM/YYYY") +
          " - " +
          dayjs(dateField.value.endDate).format("DD/MM/YYYY")
      );
    eodMessage = eodMessage.replace("{{ORGANIZATION}}", orgFilter.value);

    let todayActivities: string[] = [];
    const groupedActivities: { [key: string]: string[] } = {};

    const start = dayjs(dateField.value.startDate);
    const end = dayjs(dateField.value.endDate);
    for (let m = start; m.isBefore(end); m = m.add(1, "days")) {
      groupedActivities[m.format("YYYY-MM-DD")] = [];
    }

    if (checkedList.includes("Pull Requests Created")) {
      todayActivities = todayActivities.concat(
        activity.prs.map((pr: any) => {
          const key = dayjs(pr.created_at).format("YYYY-MM-DD");
          groupedActivities[key] ??= [];
          groupedActivities[key].push(
            `- Made PR [${getRepoName(pr.html_url)}#${pr.number}](${pr.html_url}): ${pr.title}`
          );
          return `- Made PR [${getRepoName(pr.html_url)}#${pr.number}](${pr.html_url}): ${pr.title}`;
        })
      );
    }
    if (checkedList.includes("Issues Created")) {
      todayActivities = todayActivities.concat(
        activity.issues_created.map((issue: any) => {
          const key = dayjs(issue.created_at).format("YYYY-MM-DD");
          groupedActivities[key] ??= [];
          groupedActivities[key].push(
            `- Created issue [${getRepoName(issue.html_url)}#${issue.number}](${issue.html_url}): ${issue.title}`
          );
          return `- Created issue [${getRepoName(issue.html_url)}#${issue.number}](${issue.html_url}): ${issue.title}`;
        })
      );
    }
    if (checkedList.includes("Commits Made")) {
      todayActivities = todayActivities.concat(
        activity.commits.map((commit: any) => {
          const key = dayjs(commit.created_at).format("YYYY-MM-DD");
          groupedActivities[key] ??= [];
          groupedActivities[key].push(
            `- Comitted [${getRepoName(commit.html_url)}#${commit.sha?.slice(0, 7)}](${commit.html_url}): ${
              commit.title
            }`
          );
          return `- Comitted [${getRepoName(commit.html_url)}#${commit.sha?.slice(0, 7)}](${commit.html_url}): ${
            commit.title
          }`;
        })
      );
    }
    if (checkedList.includes("PRs Merged")) {
      todayActivities = todayActivities.concat(
        activity.prs_merged.map((pr: any) => {
          const key = dayjs(pr.merged_at || pr.created_at).format("YYYY-MM-DD");
          groupedActivities[key] ??= [];
          groupedActivities[key].push(
            `- Merged PR [${getRepoName(pr.html_url)}#${pr.number}](${pr.html_url}): ${pr.title}`
          );
          return `- Merged PR [${getRepoName(pr.html_url)}#${pr.number}](${pr.html_url}): ${pr.title}`;
        })
      );
    }

    let groupedActivitiesText = "";

    if (eodSettingsCheckedList.includes("Group by week")) {
      const weekGroups: { [key: string]: string[] } = {};
      Object.keys(groupedActivities).forEach((date) => {
        if (groupedActivities[date].length === 0) return;
        const weekStart = dayjs(date).startOf("week").format("YYYY-MM-DD");
        weekGroups[weekStart] ??= [];
        weekGroups[weekStart].push(...groupedActivities[date]);
      });

      Object.keys(weekGroups).forEach((weekStart) => {
        if (weekGroups[weekStart].length === 0) return;
        const weekEnd = dayjs(weekStart).endOf("week").format("YYYY-MM-DD");
        groupedActivitiesText += `**Week of ${dayjs(weekStart).format("DD/MM/YYYY")} - ${dayjs(weekEnd).format(
          "DD/MM/YYYY"
        )}**\n${weekGroups[weekStart].join("\n")}\n\n`;
      });
      eodMessage = eodMessage.replace("{{TODAY_ACTIVITIES}}", "\n" + groupedActivitiesText.trimEnd());
    } else if (eodSettingsCheckedList.includes("Group by day")) {
      Object.keys(groupedActivities).forEach((date) => {
        if (groupedActivities[date].length === 0) return;
        groupedActivitiesText += `**${dayjs(date).format("DD/MM/YYYY")}**\n${groupedActivities[date].join("\n")}\n\n`;
      });
      eodMessage = eodMessage.replace("{{TODAY_ACTIVITIES}}", "\n" + groupedActivitiesText.trimEnd());
    } else {
      eodMessage = eodMessage.replace("{{TODAY_ACTIVITIES}}", todayActivities.join("\n"));
    }

    let tomorrowActivities: string[] = [];
    const unfinishedIssues = activity.issues_assigned.filter(
      (issue: any) => !issue.linked_pr?.length && issue.state === "open"
    );
    if (checkedList.includes("Issues Assigned")) {
      tomorrowActivities = tomorrowActivities.concat(
        unfinishedIssues.map((issue: any) => {
          return `- Work on issue [${getRepoName(issue.html_url)}#${issue.number}](${issue.html_url}): ${issue.title}`;
        })
      );
    }

    eodMessage = eodMessage.replace("{{TOMORROW_ACTIVITIES}}", tomorrowActivities.join("\n"));

    return eodMessage;
  }

  return (
    <>
      {contextHolder}
      <div className="py-6">
        <Card className="mx-auto max-w-5xl">
          <Typography>
            <Title level={3} className="text-center">
              Github Activity Report
            </Title>
            <Paragraph className="text-center text-lg">
              This is a simple EOD update generator that will help you to create a summary of your GitHub activity
            </Paragraph>
          </Typography>
          <div className="grid grid-cols-6 gap-4 mb-2">
            <div>
              <Text strong>GitHub Username</Text>
              <Paragraph className="text-xs text-gray-500">Enter your GitHub username</Paragraph>
            </div>
            <div>
              <Text strong>Organization</Text>
              <Paragraph className="text-xs text-gray-500">Select organization</Paragraph>
            </div>
            <div>
              <Text strong>Repository</Text>
              <Paragraph className="text-xs text-gray-500">Select repository</Paragraph>
            </div>
            <div>
              <Text strong>Branch</Text>
              <Paragraph className="text-xs text-gray-500">Select branch</Paragraph>
            </div>
            <div className="col-span-2">
              <Text strong>Date Range</Text>
              <Paragraph className="text-xs text-gray-500">Select time period</Paragraph>
            </div>
          </div>
          <Space.Compact className="w-full">
            <Input
              placeholder="GitHub username"
              className="w-1/6"
              value={usernameField.value}
              onChange={(e) => {
                setUsernameField({ ...usernameField, value: e.target.value, error: "" });
              }}
              status={usernameField.error ? "error" : undefined}
              suffix={
                (usernameField.state === "checking" && <LoadingOutlined />) ||
                (usernameField.value &&
                  usernameField.state === "checked" &&
                  (usernameField.error ? (
                    <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                  ) : (
                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                  ))) || <span />
              }
              onBlur={() => {
                checkGithubUsername(usernameField.value);
              }}
              onFocus={() => {
                setUsernameField({ ...usernameField, state: "focus" });
              }}
            />
            <Select
              showSearch
              className="w-1/6"
              placeholder="Select organization"
              optionFilterProp="children"
              onChange={(e) => {
                setOrgFilter({ ...orgFilter, value: e });
                fetchRepositories(e);
              }}
              value={orgFilter.value}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={orgFilter.list.map((org: { login: string }) => ({ label: org.login, value: org.login }))}
              disabled={usernameField.state !== "checked" || orgFilter.list.length === 0}
            />
            <Select
              showSearch
              className="w-1/6"
              placeholder="Select repository"
              optionFilterProp="children"
              onChange={(e) => {
                setRepoFilter({ ...repoFilter, value: e });
                fetchBranches(orgFilter.value, e);
              }}
              value={repoFilter.value}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={repoFilter.list.map((repo: { name: string }) => ({ label: repo.name, value: repo.name }))}
              disabled={!orgFilter.value || repoFilter.list.length === 0}
            />
            <Select
              showSearch
              className="w-1/6"
              placeholder="Select branch"
              optionFilterProp="children"
              onChange={(e) => {
                setBranchFilter({ ...branchFilter, value: e });
              }}
              value={branchFilter.value}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={branchFilter.list.map((branch: { name: string }) => ({
                label: branch.name,
                value: branch.name,
              }))}
              disabled={!repoFilter.value || branchFilter.list.length === 0}
            />
            <RangePicker
              className="w-1/2"
              presets={rangePresets}
              showTime
              status={dateField.error ? "error" : undefined}
              format="DD/MM/YYYY HH:mm"
              onChange={onRangeChange}
              value={[
                dateField.value.startDate ? dayjs(dateField.value.startDate) : null,
                dateField.value.endDate ? dayjs(dateField.value.endDate) : null,
              ]}
            />
            <Button
              onClick={() => {
                setShowFetchSettings(true);
              }}
              disabled={fetchBtnState === "loading"}
            >
              <SettingOutlined />
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={fetchGithubStats}
              loading={fetchBtnState === "loading"}
            >
              Fetch
            </Button>
          </Space.Compact>
          {(usernameField.error || dateField.error) && (
            <div className="mr-8">
              <Text type="danger" className={`w-1/3 inline-block ${usernameField.error ? "visible" : "invisible"}`}>
                {usernameField.error}
              </Text>
              <Text type="danger" className={`w-1/3 inline-block ${orgFilter.error ? "visible" : "invisible"}`}>
                {orgFilter.error}
              </Text>
              <Text type="danger" className={`w-1/3 inline-block ${dateField.error ? "visible" : "invisible"}`}>
                {dateField.error}
              </Text>
            </div>
          )}
          <Divider />
          {fetchBtnState === "success" &&
            (activity.merged.length > 0 ? (
              <div className="">
                <ConfigProvider
                  theme={{
                    token: {
                      padding: 12,
                    },
                  }}
                >
                  <Timeline
                    mode="left"
                    reverse
                    items={activity.merged.map((activity: any) => ({
                      label: (
                        <div className="flex justify-between">
                          <a
                            href={activity.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="italic w-[182px] whitespace-nowrap overflow-hidden overflow-ellipsis text-left"
                            style={{ direction: "rtl" }}
                          >
                            {getRepoNameFromUrl(activity.repository_url || activity.html_url) || "-"}
                            <span className="font-medium">{"#" + (activity.number || activity.sha?.slice(0, 6))}</span>
                          </a>
                          {"  "}
                          <p>
                            {dayjs(activity.merged_at || activity.assigned_at || activity.created_at).format(
                              "Do MMMM YYYY h:mm A"
                            )}
                          </p>
                        </div>
                      ),
                      color: "green",
                      dot: getTimelineDot(activity.type),
                      children: activity.title,
                    }))}
                  />
                </ConfigProvider>
              </div>
            ) : (
              <div className="text-center">
                <Text type="secondary">No activity found</Text>
              </div>
            ))}
          {activity.merged.length > 0 && (
            <>
              <Divider className="my-1" />
              <div className="flex flex-col mb-3">
                <p className="text-md text-gray-500 font-semibold mt-2">Include in EOD</p>
                <div className="grid grid-cols-4">
                  <div className="col-span-3">
                    <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                      Include All
                    </Checkbox>
                    <CheckboxGroup options={includeInEOD} value={checkedList} onChange={onChange} />
                  </div>
                  <Space.Compact className="col-span-1 mr-0 ml-auto">
                    <Button
                      type="primary"
                      icon={<SettingOutlined />}
                      onClick={() => {
                        setEodSettingsCheckedList(settings.splitByDay ? ["Group by day"] : []);
                        setShowEODSettings(true);
                      }}
                    />
                    <Button
                      type="primary"
                      className="float-right"
                      onClick={() => {
                        setEODMessage(getEODMessage());
                      }}
                    >
                      Generate EOD
                    </Button>
                  </Space.Compact>
                </div>
              </div>
            </>
          )}
          {EODMessage && (
            <div>
              <TextArea
                value={EODMessage}
                autoSize
                onChange={(e) => {
                  setEODMessage(e.target.value);
                }}
              />
              <div className="my-4"></div>
              <MarkdownPreview
                className="border border-gray-300 rounded-lg p-2"
                source={EODMessage}
                wrapperElement={{
                  "data-color-mode": "light",
                }}
              />
            </div>
          )}
        </Card>
        <Modal
          title="Fetch Settings"
          open={showFetchSettings}
          onOk={saveFetchSettings}
          onCancel={() => {
            setShowFetchSettings(false);
          }}
          footer={[
            <Button type="primary" key="back" onClick={saveFetchSettings} icon={<SaveOutlined />}>
              Save
            </Button>,
          ]}
        >
          <Text>GitHub Access Token</Text>
          <Input
            placeholder="ghp_**********"
            className="mt-2"
            value={githubTokenInput}
            onChange={(e) => {
              setGithubTokenInput(e.target.value);
            }}
          />
        </Modal>
        <Modal
          title="EOD Settings"
          open={showEODSettings}
          onOk={() => {
            saveEODSettings();
            setShowEODSettings(false);
          }}
          onCancel={() => {
            setShowEODSettings(false);
          }}
          footer={[
            <Button type="primary" key="back" onClick={saveEODSettings} icon={<SaveOutlined />}>
              Save
            </Button>,
          ]}
        >
          <CheckboxGroup options={EODSettings} value={eodSettingsCheckedList} onChange={onEodSettingChange} />
        </Modal>
      </div>
    </>
  );
}
