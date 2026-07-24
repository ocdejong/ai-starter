import { render, screen, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../theme/theme-provider";
import { HomeCard } from "./home-card";

describe("HomeCard", () => {
  it("renders API status for the user", async () => {
    render(
      <ThemeProvider>
        <HomeCard message="Hello from the API" />
      </ThemeProvider>,
    );

    // waitFor lets the provider's async hydration settle inside act.
    await waitFor(() =>
      expect(screen.getByText("AI Starter mobile")).toBeOnTheScreen(),
    );
    expect(screen.getByText("Hello from the API")).toBeOnTheScreen();
  });
});
