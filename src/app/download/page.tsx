"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Input,
  Select,
  Space,
  notification,
  Typography,
  Modal,
  Form,
  Radio,
  Switch,
  Progress,
} from "antd";
import Icon, { DownloadOutlined, SettingOutlined, CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import Title from "antd/es/typography/Title";
import Paragraph from "antd/es/typography/Paragraph";
import { useRouter } from "next/navigation";

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

const globalStyles = `
  .notification-compact {
    padding: 8px 12px !important;
  }
  .notification-compact .ant-notification-notice-message {
    margin-bottom: 0 !important;
    font-size: 12px !important;
  }
  .notification-compact .ant-notification-notice-description {
    font-size: 10px !important;
  }
  @media (max-width: 768px) {
    .ant-notification-notice {
      margin-right: 0 !important;
      margin-left: 0 !important;
    }
  }
`;

interface ActivityFilters {
  repository: string;
  dateRange: [Dayjs, Dayjs] | null;
  activityTypes: string[];
  state: "all" | "open" | "closed" | "merged";
  format: "csv" | "json";
  selectedFields: string[];
}

export default function DownloadPage() {
  const [api, contextHolder] = notification.useNotification();
  const router = useRouter();

  const notify = (type: NotificationType, message: string, description: string) => {
    api[type]({
      message,
      description,
      duration: 3,
      className: "notification-compact",
      style: {
        width: "auto",
        minWidth: "250px",
        maxWidth: "90vw",
      },
    });
  };

  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [settings, setSettings] = useState({
    fetchGithubToken: "",
  });

  const [filters, setFilters] = useState<ActivityFilters>({
    repository: "",
    dateRange: null,
    activityTypes: ["pull_requests", "issues"],
    state: "all",
    format: "csv",
    selectedFields: [
      "number",
      "title",
      "type",
      "state",
      "author",
      "created_at",
      "merged_at",
      "labels",
      "assignees",
      "html_url",
    ],
  });

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [parsedRepo, setParsedRepo] = useState<{ owner: string; repo: string } | null>(null);

  const activityTypeOptions = [
    { label: "Pull Requests", value: "pull_requests" },
    { label: "Issues", value: "issues" },
  ];

  const formatOptions = [
    { label: "CSV", value: "csv" },
    { label: "JSON", value: "json" },
  ];

  const fieldOptions = [
    { label: "Number", value: "number" },
    { label: "Title", value: "title" },
    { label: "Type", value: "type" },
    { label: "State", value: "state" },
    { label: "Author", value: "author" },
    { label: "Created At", value: "created_at" },
    { label: "Merged At", value: "merged_at" },
    { label: "Labels", value: "labels" },
    { label: "Assignees", value: "assignees" },
    { label: "URL", value: "html_url" },
  ];

  useEffect(() => {
    const githubToken = localStorage.getItem("githubToken");
    if (githubToken) {
      setGithubTokenInput(githubToken);
      setSettings({
        ...settings,
        fetchGithubToken: githubToken,
      });
    }
  }, []);

  const parseRepositoryUrl = (url: string) => {
    const patterns = [/github\.com\/([^/]+)\/([^/?]+)/, /^([^/]+)\/([^/]+)$/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(".git", ""),
        };
      }
    }
    return null;
  };

  const handleRepositoryChange = (value: string) => {
    setFilters({ ...filters, repository: value });
    const parsed = parseRepositoryUrl(value);
    setParsedRepo(parsed);
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
    notify("success", "Settings Saved", "GitHub token has been saved");
  };

  const downloadActivity = async () => {
    if (!filters.repository) {
      notify("error", "Repository Required", "Please enter a repository URL or owner/repo");
      return;
    }

    if (!filters.dateRange) {
      notify("error", "Date Range Required", "Please select a date range");
      return;
    }

    if (!parsedRepo) {
      notify("error", "Invalid Repository", "Please enter a valid repository URL or owner/repo format");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const { owner, repo } = parsedRepo;
      const startDate = filters.dateRange[0].format("YYYY-MM-DD");
      const endDate = filters.dateRange[1].format("YYYY-MM-DD");

      setDownloadProgress(25);

      // Use the new API endpoint
      const response = await fetch("/api/github-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner,
          repo,
          activityTypes: filters.activityTypes,
          startDate,
          endDate,
          state: filters.state,
          githubToken: settings.fetchGithubToken,
        }),
      });

      setDownloadProgress(75);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch activity data");
      }

      const result = await response.json();
      const allData = result.data;

      // Flatten the data structure with all possible fields
      const allFieldsData = allData.map((item: any, index: number) => ({
        slno: (index + 1).toString(),
        number: item.number || item.sha?.slice(0, 7) || "",
        title: item.title || item.commit?.message?.split("\n")[0] || "",
        type: item.type,
        state: item.state || item.merged_at ? "merged" : "open",
        author: item.user?.login || item.author?.login || item.commit?.author?.name || "",
        created_at: item.created_at || item.commit?.author?.date || "",
        merged_at: item.merged_at || "",
        labels: item.labels?.map((l: any) => l.name).join(", ") || "",
        assignees: item.assignees?.map((a: any) => a.login).join(", ") || "",
        html_url: item.html_url || "",
      }));

      // Filter data to only include selected fields, but always include slno
      const flatData = allFieldsData.map((item: any) => {
        const filteredItem: any = { slno: item.slno }; // Always include serial number
        filters.selectedFields.forEach((field) => {
          filteredItem[field] = item[field];
        });
        return filteredItem;
      });

      setDownloadProgress(100);

      // Generate download file
      let downloadContent = "";
      let filename = `${owner}-${repo}-activity-${startDate}-to-${endDate}`;

      switch (filters.format) {
        case "csv":
          downloadContent = generateCSV(flatData);
          filename += ".csv";
          break;
        case "json":
          downloadContent = JSON.stringify(flatData, null, 2);
          filename += ".json";
          break;
      }

      // Create and download file
      const blob = new Blob([downloadContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify("success", "Download Complete", `Downloaded ${flatData.length} items from ${owner}/${repo}`);
    } catch (error: any) {
      notify("error", "Download Failed", error.message);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const generateCSV = (data: any[]) => {
    if (data.length === 0) return "";

    // Always include slno as first column, then selected fields
    const headers = ["slno", ...filters.selectedFields];
    const csvRows = [headers.join(",")];

    data.forEach((item) => {
      const row = headers.map((header) => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  };

  return (
    <>
      <style jsx global>
        {globalStyles}
      </style>
      {contextHolder}
      <div className="py-8 px-4">
        <Card className="mx-auto max-w-5xl shadow-lg border-0">
          <div className="flex justify-between items-center mb-8">
            <div>
              <Title level={4} className="mb-2 text-gray-800">
                <DownloadOutlined className="mr-3 text-blue-500" />
                GitHub Activity Downloader
              </Title>
              <Paragraph className="text-sm text-gray-600">
                Download repository activity with customizable data structure
              </Paragraph>
            </div>
            <Button type="default" onClick={() => router.push("/")} className="flex items-center">
              ← Back to Activity Report
            </Button>
          </div>

          <Form layout="vertical" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Repository Input */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">Repository</span>} required>
                  <Input
                    placeholder="Enter repository URL or owner/repo (e.g., ohcnetwork/care_fe)"
                    value={filters.repository}
                    onChange={(e) => handleRepositoryChange(e.target.value)}
                    status={filters.repository && !parsedRepo ? "error" : undefined}
                    suffix={
                      filters.repository && parsedRepo ? (
                        <CheckCircleTwoTone twoToneColor="#52c41a" />
                      ) : filters.repository && !parsedRepo ? (
                        <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                      ) : (
                        <span />
                      )
                    }
                  />
                  {parsedRepo && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <Text className="text-green-700 text-sm">
                        ✓ Repository: {parsedRepo.owner}/{parsedRepo.repo}
                      </Text>
                    </div>
                  )}
                </Form.Item>
              </div>

              {/* Date Range */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">Date Range</span>} required>
                  <RangePicker
                    presets={rangePresets}
                    showTime
                    format="DD/MM/YYYY HH:mm"
                    value={filters.dateRange}
                    onChange={(dates) => setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] | null })}
                    className="w-full"
                  />
                </Form.Item>
              </div>

              {/* Activity Types */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">Activity Types</span>}>
                  <Checkbox.Group
                    options={activityTypeOptions}
                    value={filters.activityTypes}
                    onChange={(values) => setFilters({ ...filters, activityTypes: values as string[] })}
                  />
                </Form.Item>
              </div>

              {/* State Filter */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">State</span>}>
                  <Radio.Group
                    value={filters.state}
                    onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                  >
                    <Radio value="all">All</Radio>
                    <Radio value="open">Open</Radio>
                    <Radio value="closed">Closed</Radio>
                    <Radio value="merged">Merged</Radio>
                  </Radio.Group>
                </Form.Item>
              </div>

              {/* Download Format */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">Download Format</span>}>
                  <Radio.Group
                    value={filters.format}
                    onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                    className="space-y-2"
                  >
                    {formatOptions.map((option) => (
                      <Radio key={option.value} value={option.value}>
                        {option.label}
                      </Radio>
                    ))}
                  </Radio.Group>
                </Form.Item>
              </div>
            </div>

            {/* Field Selection */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <Form.Item label={<span className="text-blue-800 font-medium">Select Fields to Include</span>}>
                <div className="bg-white p-4 rounded border">
                  <Checkbox.Group
                    options={fieldOptions}
                    value={filters.selectedFields}
                    onChange={(values) => setFilters({ ...filters, selectedFields: values as string[] })}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
                  />
                </div>
              </Form.Item>
            </div>

            {/* Settings and Download Buttons */}
            <div className="flex justify-between items-center mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
              <div>
                <Button
                  onClick={() => {
                    const modal = Modal.info({
                      title: "GitHub Settings",
                      content: (
                        <div>
                          <Text>GitHub Access Token</Text>
                          <Input
                            placeholder="ghp_**********"
                            className="mt-2"
                            value={githubTokenInput}
                            onChange={(e) => setGithubTokenInput(e.target.value)}
                          />
                          <Paragraph className="text-xs text-gray-500 mt-2">
                            Add a GitHub token to access private repositories and increase API rate limits
                          </Paragraph>
                        </div>
                      ),
                      onOk: saveFetchSettings,
                    });
                  }}
                  size="large"
                  className="flex items-center"
                >
                  <SettingOutlined className="mr-2" />
                  Settings
                </Button>
              </div>

              <Button
                type="primary"
                onClick={downloadActivity}
                loading={isDownloading}
                disabled={!filters.repository || !filters.dateRange || !parsedRepo}
                size="large"
              >
                <DownloadOutlined className="mr-2" />
                Download Activity
              </Button>
            </div>

            {/* Progress Bar */}
            {isDownloading && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  <Text className="text-green-700 font-medium">Downloading activity data...</Text>
                </div>
                <Progress percent={downloadProgress} status="active" strokeColor="#10b981" className="mb-2" />
                <Text className="text-green-600 text-sm">{downloadProgress}% complete</Text>
              </div>
            )}
          </Form>

          {/* Data Structure Info */}
          {/* <Divider />
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-indigo-600 font-bold">i</span>
              </div>
              <Title level={4} className="text-indigo-800 mb-0">
                Available Fields
              </Title>
            </div>
            <Paragraph className="text-gray-700">
              <Text strong className="text-indigo-800">
                Select the fields you want in your download:
              </Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Number</strong> - PR/Issue number or commit SHA
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Title</strong> - Title of the PR/Issue or commit message
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Type</strong> - pull_requests, issues, or commits
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>State</strong> - open, closed, or merged
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Author</strong> - Username of the creator
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Created At</strong> - Creation timestamp
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Merged At</strong> - Merge timestamp (for PRs)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Labels</strong> - Comma-separated list of labels
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>Assignees</strong> - Comma-separated list of assignees
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                    <span>
                      <strong>URL</strong> - GitHub URL
                    </span>
                  </div>
                </div>
              </div>
            </Paragraph>
          </div> */}
        </Card>
      </div>
    </>
  );
}
