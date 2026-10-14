import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { transformWithOxc } from "vite";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import {emptyAssessment} from "../src/lib/intelligence.js";
import { emptyData } from "../src/lib/domain.js";
test("BI review, pipeline, research queue and master task editing use real commands and preserve unknowns", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://localhost/",
  });
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "Node",
    "MutationObserver",
    "getComputedStyle",
  ])
    Object.defineProperty(globalThis, name, {
      value: dom.window[name],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { render, screen, fireEvent, waitFor, cleanup } =
    await import("@testing-library/react");
  const dir = mkdtempSync(join(process.cwd(), ".ui-test-"));
  const components = {};
  for (const name of ["Intelligence", "MasterTasks"]) {
    const raw = readFileSync(
      new URL("../src/" + name + ".jsx", import.meta.url),
      "utf8",
    )
      .replace('import "./intelligence.css";', "")
      .replaceAll(
        'from "./',
        'from "' + pathToFileURL(join(process.cwd(), "src")).href + "/",
      );
    const r = await transformWithOxc(raw, name + ".jsx", {
      jsx: { runtime: "automatic" },
    });
    const path = join(dir, name + ".mjs");
    writeFileSync(path, r.code);
    components[name] = (await import(pathToFileURL(path).href)).default;
  }
  try {
    const data = emptyData();
    data.businesses = [
      {
        id: "test-business",
        name: "Fictional studio",
        city: "Longmont",
        kind: "Prospect",
        stage: "New",
        website: "https://example.com",
        categories: ["Art"],
      },
    ];
    data.tasks = [
      {
        id: "test-task",
        title: "Review studio",
        status: "Open",
        priority: "Normal",
        type: "Task",
        assignee: "Michelle",
        notes: "Existing evidence",
        details: { company: "MKT Visibility" },
      },
    ];
    const member = { display_name: "Michelle", role: "owner" },
      commands = [],
      queues = [];
    const bi = {
      profiles: [
        {
          id: "profile",
          business_id: "test-business",
          approved: {...emptyAssessment(data.businesses[0]),summary:"PRIVATE SALES NOTE",services:"INTERNAL SALES STRATEGY"},
          crm: { stage: "Researching" },
          updated_at: "2026-10-14T00:00:00Z",
        },
      ],
      research: [],
      suggestions: [],
      jobs: [],
      settings: [],
    };
    const repository = {
      intelligence: {
        load: async () => bi,
        workerStatus: async () => ({ configured: false }),
        queue: async (ids) => {
          queues.push(ids);
          return ids.length;
        },
        command: async (action, input) => {
          commands.push({ action, input });
          return {};
        },
      },
    };
    render(
      React.createElement(components.Intelligence, {
        repository,
        data,
        member,
        writable: true,
        onView: () => {},
        onRefresh: () => {},
      }),
    );
    await waitFor(() =>
      assert.ok(screen.getByText(/1 central records connected/)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advanced research" }));
    assert.ok(screen.getByText(/Never/));
    fireEvent.click(screen.getByRole("button", {name:"Visibility Check report"}));
    assert.equal(screen.queryByText("PRIVATE SALES NOTE"),null);
    assert.equal(screen.queryByText("INTERNAL SALES STRATEGY"),null);
    fireEvent.click(screen.getByRole("button", {name:"Close report"}));
    fireEvent.click(screen.getByRole("button", { name: "Approve assessment" }));
    await waitFor(() => assert.equal(commands[0]?.action, "approve"));
    assert.equal(commands[0].input.assessment.platforms.Website.score, null);
    fireEvent.click(screen.getByRole("button", { name: "Research Business" }));
    await waitFor(() => assert.equal(queues.length, 1));
    assert.deepEqual(queues[0], ["test-business"]);
    fireEvent.change(screen.getAllByLabelText("Pipeline stage").at(-1), {
      target: { value: "Qualified" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save pipeline details" }),
    );
    await waitFor(() =>
      assert.ok(
        commands.some(
          (c) => c.action === "crm" && c.input.crm.stage === "Qualified",
        ),
      ),
    );
    cleanup();
    const saved = [];
    render(
      React.createElement(components.MasterTasks, {
        data,
        member,
        writable: true,
        onSave: async (kind, draft) => saved.push({ kind, draft }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Verify studio address" },
    });
    fireEvent.change(screen.getAllByLabelText("Status").at(-1), {
      target: { value: "Awaiting Review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].draft.status, "Awaiting Review");
    assert.equal(saved[0].draft.notes, "Existing evidence");
    assert.equal(saved[0].draft.id, "test-task");
    cleanup();
  } finally {
    cleanup();
    rmSync(dir, { recursive: true, force: true });
    dom.window.close();
  }
});
