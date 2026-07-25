import { render, screen } from "@testing-library/react-native";

import { TestProviders } from "../../test/providers";
import { GroupSection } from "./group-section";

describe("GroupSection", () => {
  it("names the section it reserves", async () => {
    await render(
      <TestProviders>
        <GroupSection />
      </TestProviders>,
    );

    expect(screen.getByText("Group")).toBeOnTheScreen();
    expect(
      screen.getByText("Your group settings will appear here."),
    ).toBeOnTheScreen();
  });

  it("renders in Dutch under the Dutch catalog", async () => {
    await render(
      <TestProviders locale="nl">
        <GroupSection />
      </TestProviders>,
    );

    expect(screen.getByText("Groep")).toBeOnTheScreen();
    expect(
      screen.getByText("Je groepsinstellingen verschijnen hier."),
    ).toBeOnTheScreen();
  });
});
