import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserToolHandler } from "../BrowserToolHandler";

describe("BrowserToolHandler", () => {
  const defaultProps = {
    part: {
      toolCallId: "call-1",
      state: "output-available",
      input: {
        action: "navigate",
        url: "https://example.com",
        brief: "Navigate to example page",
      },
      output: {
        success: true,
        url: "https://example.com",
        title: "Example Title",
        screenshot: "fake-base64-screenshot-data",
        result: { status: 200 },
      },
    },
    status: "ready" as const,
  };

  it("renders navigate status with brief label when successful", () => {
    render(<BrowserToolHandler {...defaultProps} />);
    
    expect(screen.getByText("Navigate to example page")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("toggles the screenshot when the tool block or chevron is clicked", () => {
    render(<BrowserToolHandler {...defaultProps} />);
    
    // Screenshot should not be visible initially
    expect(screen.queryByAltText("Page screenshot")).not.toBeInTheDocument();

    // Click the expand button (chevron)
    const toggleButton = screen.getByLabelText("Expand screenshot");
    fireEvent.click(toggleButton);

    // Screenshot should now be visible
    expect(screen.getByAltText("Page screenshot")).toBeInTheDocument();
    expect(screen.getByText("Title:")).toBeInTheDocument();
    expect(screen.getByText("Example Title")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByAltText("Page screenshot")).not.toBeInTheDocument();
  });

  it("renders a loading shimmer during input-streaming", () => {
    const streamingProps = {
      ...defaultProps,
      part: {
        ...defaultProps.part,
        state: "input-streaming",
      },
      status: "streaming" as const,
    };

    render(<BrowserToolHandler {...streamingProps} />);
    expect(screen.getByText("Navigate to example page")).toBeInTheDocument();
  });

  it("renders a failure block when success is false", () => {
    const failedProps = {
      ...defaultProps,
      part: {
        ...defaultProps.part,
        output: {
          success: false,
          url: null,
          title: null,
          screenshot: null,
          error: "Failed to connect to page",
        },
      },
    };

    render(<BrowserToolHandler {...failedProps} />);
    expect(screen.getByText("Browsing failed: Failed to connect to page")).toBeInTheDocument();
  });
});
