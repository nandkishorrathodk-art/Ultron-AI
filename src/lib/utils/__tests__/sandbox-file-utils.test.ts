jest.mock("server-only", () => ({}), { virtual: true });

import type { UIMessage } from "ai";
import {
  prepareLocalDesktopAttachmentsForTrigger,
  rewriteSandboxFilePathsInMessages,
  stripLocalDesktopSourcePaths,
  uploadSandboxFiles,
} from "../sandbox-file-utils";

const makeLocalMessage = (): UIMessage =>
  ({
    id: "m1",
    role: "user",
    parts: [
      { type: "text", text: "inspect this" },
      {
        type: "file",
        storage: "local-desktop",
        localAttachmentId: "local-1",
        localPath: "/Users/alice/Secrets/report.pdf",
        name: "report.pdf",
        mediaType: "application/pdf",
        size: 123,
      },
    ],
  }) as UIMessage;

describe("desktop-local sandbox file helpers", () => {
  it("removes source paths before persistence", () => {
    const [message] = stripLocalDesktopSourcePaths([makeLocalMessage()]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filePart = message.parts?.find((part: any) => part.type === "file");
    expect(filePart).toMatchObject({
      type: "file",
      storage: "local-desktop",
      localAttachmentId: "local-1",
      name: "report.pdf",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((filePart as any).localPath).toBeUndefined();
  });

  it("prepares trigger messages with staged attachment tags but no source path", () => {
    const { messages, sandboxFiles } = prepareLocalDesktopAttachmentsForTrigger(
      [makeLocalMessage()],
      "/tmp/Ultron-AI-upload",
    );

    expect(sandboxFiles).toEqual([
      {
        kind: "localPath",
        path: "/Users/alice/Secrets/report.pdf",
        localPath: "/tmp/Ultron-AI-upload/report.pdf",
      },
    ]);
    expect(JSON.stringify(messages)).not.toContain(
      "/Users/alice/Secrets/report.pdf",
    );
    expect(
      messages[0].parts?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (part: any) =>
          part.type === "text" &&
          part.text ===
            '<attachment filename="report.pdf" local_path="/tmp/Ultron-AI-upload/report.pdf" />',
      ),
    ).toBe(true);
  });

  it("copies desktop-local files through the local sandbox instead of downloading", async () => {
    const copyLocal = jest.fn().mockResolvedValue(undefined);
    const downloadFromUrl = jest.fn();

    const result = await uploadSandboxFiles(
      [
        {
          kind: "localPath",
          path: "/Users/alice/Secrets/report.pdf",
          localPath: "/tmp/Ultron-AI-upload/report.pdf",
        },
      ],
      async () => ({
        files: { copyLocal, downloadFromUrl },
      }),
    );

    expect(result.failedCount).toBe(0);
    expect(copyLocal).toHaveBeenCalledWith(
      "/Users/alice/Secrets/report.pdf",
      "/tmp/Ultron-AI-upload/report.pdf",
    );
    expect(downloadFromUrl).not.toHaveBeenCalled();
  });

  it("redacts desktop source paths from staging failure logs", async () => {
    const sourcePath = "/Users/alice/Secrets/report.pdf";
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      await uploadSandboxFiles(
        [
          {
            kind: "localPath",
            path: sourcePath,
            localPath: "/tmp/Ultron-AI-upload/report.pdf",
          },
        ],
        async () => ({
          files: {
            copyLocal: jest
              .fn()
              .mockRejectedValue(
                new Error(`Failed to copy ${sourcePath}: permission denied`),
              ),
          },
        }),
      );

      const logged = consoleErrorSpy.mock.calls
        .map((call) => JSON.stringify(call))
        .join("\n");
      expect(logged).not.toContain(sourcePath);
      expect(logged).toContain("[redacted-local-path]");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("retries url uploads in a writable directory when /tmp is not writable", async () => {
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const downloadFromUrl = jest
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Failed to download file: mkdir: cannot create directory '/tmp/Ultron-AI-upload': Permission denied",
        ),
      )
      .mockResolvedValueOnce(undefined);
    const run = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "/home/alice/Ultron-AI-upload/report.pdf",
      stderr: "",
    });

    try {
      const result = await uploadSandboxFiles(
        [
          {
            kind: "url",
            url: "https://example.com/report.pdf",
            localPath: "/tmp/Ultron-AI-upload/report.pdf",
          },
        ],
        async () => ({
          commands: { run },
          files: { downloadFromUrl },
        }),
      );

      expect(result).toEqual({
        failedCount: 0,
        pathRewrites: [
          {
            from: "/tmp/Ultron-AI-upload/report.pdf",
            to: "/home/alice/Ultron-AI-upload/report.pdf",
          },
        ],
      });
      expect(downloadFromUrl).toHaveBeenCalledWith(
        "https://example.com/report.pdf",
        "/tmp/Ultron-AI-upload/report.pdf",
      );
      expect(downloadFromUrl).toHaveBeenCalledWith(
        "https://example.com/report.pdf",
        "/home/alice/Ultron-AI-upload/report.pdf",
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("blocks internal URL downloads before invoking the sandbox", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const downloadFromUrl = jest.fn();

    try {
      const result = await uploadSandboxFiles(
        [
          {
            kind: "url",
            url: "http://169.254.169.254/latest/meta-data",
            localPath: "/home/user/upload/meta-data",
          },
        ],
        async () => ({
          files: { downloadFromUrl },
        }),
      );

      expect(result.failedCount).toBe(1);
      expect(downloadFromUrl).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("rewrites attachment tags after upload path fallback", () => {
    const messages = [
      {
        id: "m1",
        role: "user",
        parts: [
          {
            type: "text",
            text: '<attachment filename="report.pdf" local_path="/tmp/Ultron-AI-upload/report.pdf" />',
          },
        ],
      },
    ] as UIMessage[];

    const rewritten = rewriteSandboxFilePathsInMessages(messages, [
      {
        from: "/tmp/Ultron-AI-upload/report.pdf",
        to: "/home/alice/Ultron-AI-upload/report.pdf",
      },
    ]);

    expect(rewritten[0].parts?.[0]).toMatchObject({
      text: '<attachment filename="report.pdf" local_path="/home/alice/Ultron-AI-upload/report.pdf" />',
    });
  });
});
