import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotificationFeed } from "@/components/NotificationFeed";

describe("NotificationFeed", () => {
  it("hides admin notifications from non-admin users", () => {
    render(<NotificationFeed user={{ id: "user_1", roles: ["AUTHENTICATED"] }} />);

    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(screen.getByText("Workspace search updated")).toBeInTheDocument();
    expect(screen.queryByText("Admin bulk actions available")).not.toBeInTheDocument();
    expect(screen.queryByText("Deferred job notifications routed")).not.toBeInTheDocument();
  });

  it("shows admin notifications to admins", () => {
    render(<NotificationFeed user={{ id: "admin_1", roles: ["ADMIN"] }} />);

    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(screen.getByText("Admin bulk actions available")).toBeInTheDocument();
    expect(screen.getByText("Deferred job notifications routed")).toBeInTheDocument();
  });
});
