import { render } from "@testing-library/react-native";

import { HomeCard } from "./home-card";

describe("HomeCard", () => {
  it("renders API status for the user", async () => {
    const screen = await render(<HomeCard message="Hello from the API" />);

    expect(screen.getByText("t3-test mobile")).toBeOnTheScreen();
    expect(screen.getByText("Hello from the API")).toBeOnTheScreen();
  });
});
