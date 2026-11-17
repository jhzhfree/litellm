import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../tests/test-utils";
import { CommunityEngagementButtons } from "./CommunityEngagementButtons";

let mockUseDisableShowPromptsImpl = () => false;
let mockCommunityLinksEnabled = false;

vi.mock("@/app/(dashboard)/hooks/useDisableShowPrompts", () => ({
  useDisableShowPrompts: () => mockUseDisableShowPromptsImpl(),
}));

vi.mock("@/config/enterpriseFeatures", () => ({
  ENTERPRISE_FEATURES: {
    get communityLinks() {
      return mockCommunityLinksEnabled;
    },
  },
}));

describe("CommunityEngagementButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDisableShowPromptsImpl = () => false;
    mockCommunityLinksEnabled = false;
  });

  it("should not render in the enterprise build by default", () => {
    renderWithProviders(<CommunityEngagementButtons />);

    expect(screen.queryByRole("link", { name: /join slack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /litellm on github/i })).not.toBeInTheDocument();
  });

  it("should render when community links are enabled upstream", () => {
    mockCommunityLinksEnabled = true;
    renderWithProviders(<CommunityEngagementButtons />);

    const joinSlackLink = screen.getByRole("link", { name: /join slack/i });
    expect(joinSlackLink).toBeInTheDocument();
    expect(joinSlackLink).toHaveAttribute("href", "/docs");
    expect(joinSlackLink).toHaveAttribute("target", "_blank");
    expect(joinSlackLink).toHaveAttribute("rel", "noopener noreferrer");

    const githubLink = screen.getByRole("link", { name: /litellm on github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("href", "/docs");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should not render buttons when prompts are disabled", () => {
    mockCommunityLinksEnabled = true;
    mockUseDisableShowPromptsImpl = () => true;

    renderWithProviders(<CommunityEngagementButtons />);

    expect(screen.queryByRole("link", { name: /join slack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /litellm on github/i })).not.toBeInTheDocument();
  });
});
