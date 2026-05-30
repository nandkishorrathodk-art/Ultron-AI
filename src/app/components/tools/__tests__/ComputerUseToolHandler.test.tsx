import { render, screen, fireEvent } from "@testing-library/react";
import { ComputerUseToolHandler } from "../ComputerUseToolHandler";

describe("ComputerUseToolHandler", () => {
  const defaultProps = {
    part: {
      toolCallId: "call-1",
      state: "output-available",
      input: {
        action: "click",
        x: 500,
        y: 400,
        brief: "Click the start button",
      },
      output: {
        success: true,
        screenshot: "fake-base64-desktop-screenshot",
      },
    },
    status: "ready" as const,
  };

  it("renders click status with brief label when successful", () => {
    render(<ComputerUseToolHandler {...defaultProps} />);
    
    expect(screen.getByText("Click the start button")).toBeInTheDocument();
  });

  it("toggles the desktop screenshot when chevron is clicked", () => {
    render(<ComputerUseToolHandler {...defaultProps} />);
    
    // Screenshot should not be visible initially
    expect(screen.queryByAltText("Desktop screenshot")).not.toBeInTheDocument();

    // Click the expand button (chevron)
    const toggleButton = screen.getByLabelText("Expand desktop screenshot");
    fireEvent.click(toggleButton);

    // Screenshot should now be visible
    expect(screen.getByAltText("Desktop screenshot")).toBeInTheDocument();
    expect(screen.getByText("Host Desktop Preview")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByAltText("Desktop screenshot")).not.toBeInTheDocument();
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

    render(<ComputerUseToolHandler {...streamingProps} />);
    expect(screen.getByText("Click the start button")).toBeInTheDocument();
  });

  it("renders a failure block when success is false", () => {
    const failedProps = {
      ...defaultProps,
      part: {
        ...defaultProps.part,
        output: {
          success: false,
          screenshot: null,
          error: "Permission denied to capture screen",
        },
      },
    };

    render(<ComputerUseToolHandler {...failedProps} />);
    expect(screen.getByText("Desktop control failed: Permission denied to capture screen")).toBeInTheDocument();
  });
});
