"use client";

import React, { useState } from "react";
import { Button, Card, Input, notification, Typography, Form, Radio, Alert, Checkbox, DatePicker } from "antd";
import { DownloadOutlined, CopyOutlined } from "@ant-design/icons";
import Title from "antd/es/typography/Title";
import Paragraph from "antd/es/typography/Paragraph";
import { useRouter } from "next/navigation";
import type { Dayjs } from "dayjs";

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

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

interface ConverterState {
  jsonInput: string;
  csvOutput: string;
  selectedFields: string[];
  isConverting: boolean;
}

interface CommandGenerator {
  repository: string;
  state: "merged" | "open" | "closed";
  dateRange: [Dayjs, Dayjs] | null;
  selectedCommandFields: string[];
  generatedCommand: string;
}

const fieldOptions = [
  { label: "Number", value: "number" },
  { label: "Title", value: "title" },
  { label: "State", value: "state" },
  { label: "Author", value: "author" },
  { label: "Created At", value: "createdAt" },
  { label: "Merged At", value: "mergedAt" },
  { label: "Labels", value: "labels" },
  { label: "Assignees", value: "assignees" },
  { label: "URL", value: "url" },
];

export default function DownloadPage() {
  const [api, contextHolder] = notification.useNotification();
  const router = useRouter();

  const [converter, setConverter] = useState<ConverterState>({
    jsonInput: "",
    csvOutput: "",
    selectedFields: [],
    isConverting: false,
  });

  const [commandGenerator, setCommandGenerator] = useState<CommandGenerator>({
    repository: "",
    state: "merged",
    dateRange: null,
    selectedCommandFields: [
      "number",
      "title",
      "state",
      "author",
      "createdAt",
      "mergedAt",
      "labels",
      "assignees",
      "url",
    ],
    generatedCommand: "",
  });

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

  const generateCommand = () => {
    if (!commandGenerator.repository) {
      notify("error", "Repository Required", "Please enter a repository");
      return;
    }

    const parsed = parseRepositoryUrl(commandGenerator.repository);
    if (!parsed) {
      notify("error", "Invalid Repository", "Please enter a valid repository URL or owner/repo format");
      return;
    }

    let command = `gh pr list --repo ${parsed.owner}/${parsed.repo} --state ${commandGenerator.state}`;

    // Add JSON fields
    const jsonFields = commandGenerator.selectedCommandFields.join(",");
    command += ` --json "${jsonFields}"`;

    // Add date range if selected
    if (commandGenerator.dateRange) {
      const startDate = commandGenerator.dateRange[0].format("YYYY-MM-DD");
      const endDate = commandGenerator.dateRange[1].format("YYYY-MM-DD");
      command += ` --search "is:pr merged:${startDate}..${endDate}"`;
    }

    command += ` --limit 300`;

    setCommandGenerator((prev) => ({ ...prev, generatedCommand: command }));
  };

  const copyCommand = () => {
    if (commandGenerator.generatedCommand) {
      navigator.clipboard.writeText(commandGenerator.generatedCommand);
      notify("success", "Command Copied", "GitHub CLI command copied to clipboard");
    }
  };

  const convertJsonToCsv = (jsonData: any[], selectedFields: string[]) => {
    if (jsonData.length === 0) return "";

    // Always include slno as first column, then selected fields
    const headers = ["slno", ...selectedFields];
    const csvRows = [headers.join(",")];

    jsonData.forEach((item, index) => {
      const row = headers.map((header) => {
        let value = "";
        if (header === "slno") {
          value = (index + 1).toString();
        } else {
          value = item[header];
          if (value === null || value === undefined) value = "";
          if (Array.isArray(value)) value = value.join(", ");
          if (typeof value === "object") value = JSON.stringify(value);
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  };

  const handleConvert = () => {
    if (!converter.jsonInput.trim()) {
      notify("error", "Input Required", "Please paste your JSON data");
      return;
    }

    setConverter({ ...converter, isConverting: true });

    try {
      const jsonData = JSON.parse(converter.jsonInput);

      if (!Array.isArray(jsonData)) {
        notify("error", "Invalid JSON", "Please provide a JSON array");
        setConverter({ ...converter, isConverting: false });
        return;
      }

      // Auto-detect fields from the first item
      const firstItem = jsonData[0] || {};
      const availableFields = Object.keys(firstItem).filter((key) =>
        fieldOptions.some((option) => option.value === key)
      );

      // Set default selected fields if none are selected
      const selectedFields = converter.selectedFields.length > 0 ? converter.selectedFields : availableFields;

      setConverter((prev) => ({ ...prev, selectedFields }));

      const output = convertJsonToCsv(jsonData, selectedFields);

      setConverter((prev) => ({
        ...prev,
        csvOutput: output,
        isConverting: false,
      }));

      notify("success", "Conversion Complete", `Converted ${jsonData.length} items`);
    } catch (error: any) {
      notify("error", "Conversion Failed", error.message);
      setConverter((prev) => ({ ...prev, isConverting: false }));
    }
  };

  const handleDownload = () => {
    if (!converter.csvOutput) {
      notify("error", "No Output", "Please convert data first");
      return;
    }

    const filename = `converted-data.csv`;
    const blob = new Blob([converter.csvOutput], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    notify("success", "Download Complete", `Downloaded ${filename}`);
  };

  const handleClear = () => {
    setConverter({
      jsonInput: "",
      csvOutput: "",
      selectedFields: [],
      isConverting: false,
    });
  };

  return (
    <>
      <style jsx global>
        {globalStyles}
      </style>
      {contextHolder}
      <div className="py-8 px-4">
        <Card className="mx-auto max-w-6xl shadow-lg border-0">
          <div className="flex justify-between items-center mb-8">
            <div>
              <Title level={4} className="mb-2 text-gray-800">
                <DownloadOutlined className="mr-3 text-blue-500" />
                JSON to CSV Converter
              </Title>
              <Paragraph className="text-sm text-gray-600">Convert GitHub CLI JSON output to CSV format</Paragraph>
            </div>
            <Button type="default" onClick={() => router.push("/")} className="flex items-center">
              ← Back to Activity Report
            </Button>
          </div>

          <Alert
            message="How to use"
            description="1. Generate the GitHub CLI command below. 2. Run it in your terminal. 3. Copy the JSON output and paste it in the converter. 4. Select the fields you want to include. 5. Convert and download."
            type="info"
            showIcon
            className="mb-6"
          />

          {/* Command Generator Section */}
          <div className="bg-gray-50 p-6 rounded-lg border border-green-200 mb-6">
            <Title level={5} className="text-green-800 mb-4">
              🔧 Generate GitHub CLI Command
            </Title>

            <div>
              {/* Repository Input */}
              <div>
                <Form.Item label={<span className="text-gray-700 font-medium">Repository</span>} required>
                  <Input
                    placeholder="owner/repo or URL"
                    value={commandGenerator.repository}
                    onChange={(e) => setCommandGenerator({ ...commandGenerator, repository: e.target.value })}
                    status={
                      commandGenerator.repository && !parseRepositoryUrl(commandGenerator.repository)
                        ? "error"
                        : undefined
                    }
                  />
                </Form.Item>
              </div>

              {/* State Selection */}
              <div>
                <Form.Item label={<span className="text-gray-700 font-medium">State</span>}>
                  <Radio.Group
                    value={commandGenerator.state}
                    onChange={(e) => setCommandGenerator({ ...commandGenerator, state: e.target.value })}
                  >
                    <Radio value="merged">Merged</Radio>
                    <Radio value="open">Open</Radio>
                    <Radio value="closed">Closed</Radio>
                  </Radio.Group>
                </Form.Item>
              </div>

              {/* Date Range */}
              <div>
                <Form.Item label={<span className="text-gray-700 font-medium">Date Range (Optional)</span>}>
                  <RangePicker
                    value={commandGenerator.dateRange}
                    onChange={(dates) =>
                      setCommandGenerator({ ...commandGenerator, dateRange: dates as [Dayjs, Dayjs] | null })
                    }
                    className="w-full"
                  />
                </Form.Item>
              </div>
            </div>

            {/* Command Fields Selection */}
            <div className="mt-4">
              <Form.Item>
                <Title level={5} className="text-sm mb-4">
                  JSON Fields to Include
                </Title>
                <div>
                  <Checkbox.Group
                    options={fieldOptions}
                    value={commandGenerator.selectedCommandFields}
                    onChange={(values: any) =>
                      setCommandGenerator({ ...commandGenerator, selectedCommandFields: values as string[] })
                    }
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
                  />
                </div>
              </Form.Item>
            </div>
            {/* Generate Button */}

            <Button type="primary" onClick={generateCommand} disabled={!commandGenerator.repository} className="w-full">
              Generate Command
            </Button>
          </div>

          {/* Generated Command */}
          {commandGenerator.generatedCommand && (
            <div className="bg-white p-4 rounded border">
              <div className="flex justify-between items-center mb-2">
                <Text strong className="text-gray-700">
                  Generated Command:
                </Text>
                <Button type="text" icon={<CopyOutlined />} onClick={copyCommand} size="small">
                  Copy
                </Button>
              </div>
              <TextArea value={commandGenerator.generatedCommand} readOnly rows={2} className="font-mono text-sm" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">JSON Input</span>} required>
                  <TextArea
                    rows={15}
                    placeholder="Paste your JSON data here..."
                    value={converter.jsonInput}
                    onChange={(e) => setConverter({ ...converter, jsonInput: e.target.value })}
                    className="font-mono text-sm"
                  />
                </Form.Item>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <Button
                  type="primary"
                  onClick={handleConvert}
                  loading={converter.isConverting}
                  disabled={!converter.jsonInput.trim()}
                  size="large"
                  className="flex-1"
                >
                  Convert
                </Button>
                <Button onClick={handleClear} size="large" className="flex-1">
                  Clear
                </Button>
              </div>
            </div>

            {/* Output Section */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded-lg">
                <Form.Item label={<span className="text-gray-700 font-medium">Output</span>}>
                  <TextArea
                    rows={15}
                    value={converter.csvOutput}
                    readOnly
                    placeholder="Converted output will appear here..."
                    className="font-mono text-sm"
                  />
                </Form.Item>
              </div>

              <Button
                type="primary"
                onClick={handleDownload}
                disabled={!converter.csvOutput}
                size="large"
                className="w-full"
                icon={<DownloadOutlined />}
              >
                Download CSV
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
