import { useEffect, useState } from "react";
import { BRANDS, toCsv } from "./lib/domain.js";
import { brandOf, metadata } from "./lib/portfolio.js";
import { TASK_STATUSES, CATEGORIES } from "./lib/intelligence.js";
import "./intelligence.css";
function TaskEditor({ task, data, onSave, onClose, writable, repository }) {
  const [draft, setDraft] = useState({
      ...task,
      title: task.title || "",
      type: task.type || "Task",
      status: task.status || "Open",
      priority: task.priority || "Normal",
      assignee: task.assignee || "Unassigned",
      details: {
        company: brandOf(task, data) || "MKT Visibility",
        category: "Other",
        ...task.details,
      },
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (!task.id || !repository?.intelligence) return;
    let active = true;
    repository.intelligence
      .taskHistory(task.id)
      .then((rows) => active && setHistory(rows))
      .catch((e) => active && setHistoryError(e.message));
    return () => {
      active = false;
    };
  }, [task.id, repository]);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    detail = (key, value) =>
      setDraft((d) => ({ ...d, details: { ...d.details, [key]: value } }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave("tasks", draft);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal bi-task-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Task editor"
      >
        <div className="section-head">
          <h2>{task.id ? "Edit task" : "New task"}</h2>
          <button onClick={onClose}>Close</button>
        </div>
        {error && <p className="error">{error}</p>}
        <form onSubmit={submit}>
          <fieldset disabled={!writable || busy}>
            <div className="bi-grid">
              <label>
                Task title
                <input
                  required
                  maxLength="200"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <label>
                Company
                <select
                  value={draft.details.company}
                  onChange={(e) => detail("company", e.target.value)}
                >
                  {["Unassigned", ...BRANDS].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label>
                Related business
                <select
                  value={draft.business_id || ""}
                  onChange={(e) => set("business_id", e.target.value || null)}
                >
                  <option value="">None</option>
                  {data.businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <input
                  value={draft.details.project || metadata(task).pageName || ""}
                  onChange={(e) => detail("project", e.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={draft.details.category}
                  onChange={(e) => detail("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {Object.entries(TASK_STATUSES).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={draft.priority}
                  onChange={(e) => set("priority", e.target.value)}
                >
                  {["High", "Normal", "Low"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Assigned person
                <select
                  value={draft.assignee}
                  onChange={(e) => set("assignee", e.target.value)}
                >
                  {[
                    ...new Set([
                      "Unassigned",
                      "Michelle",
                      "Tim",
                      draft.assignee,
                    ]),
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  required={draft.type === "Follow-up"}
                  value={draft.due_date || ""}
                  onChange={(e) => set("due_date", e.target.value)}
                />
              </label>
              <label>
                Recurrence
                <select
                  value={draft.details.recurrence || "None"}
                  onChange={(e) => detail("recurrence", e.target.value)}
                >
                  {["None", "Daily", "Weekly", "Monthly"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Execution
                <select
                  value={draft.details.execution || "Human Review"}
                  onChange={(e) => detail("execution", e.target.value)}
                >
                  {["AI-executable", "Human Review", "External Action"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Dependencies (saved task IDs, one per line)
                <textarea
                  value={(draft.details.dependencies || []).join("\n")}
                  onChange={(e) =>
                    detail(
                      "dependencies",
                      e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={draft.details.description || ""}
                onChange={(e) => detail("description", e.target.value)}
              />
            </label>
            <label>
              Notes
              <textarea
                value={draft.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            <label>
              Attachment / document links (one URL per line)
              <textarea
                value={(draft.details.attachments || []).join("\n")}
                onChange={(e) =>
                  detail(
                    "attachments",
                    e.target.value
                      .split("\n")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <p className="fine">
              Attach existing secure document links. Access follows the linked
              document's own permissions.
            </p>
            <button className="primary">
              {busy ? "Saving…" : "Save task"}
            </button>
          </fieldset>
        </form>
        {task.id && (
          <details>
            <summary>Activity and completion history</summary>
            {historyError && <p>{historyError}</p>}
            {history.map((h) => (
              <p key={h.id}>
                {new Date(h.created_at).toLocaleString()} · {h.action} ·{" "}
                {(h.changed_fields || []).join(", ") || "Created"}
              </p>
            ))}
            <p>Task ID: {task.id}</p>
            <p>Created: {task.created_at || "Unknown"}</p>
            <p>
              Completed:{" "}
              {task.completed_at ||
                metadata(task).evidenceCompletion?.completedOn ||
                "Not recorded"}{" "}
              · {task.completed_by_name || "Reviewer not recorded"}
            </p>
            <p>Evidence: {metadata(task).evidenceCompletion?.evidence || ""}</p>
          </details>
        )}
      </section>
    </div>
  );
}
export default function MasterTasks({
  data,
  member,
  writable,
  onSave,
  repository,
}) {
  const [search, setSearch] = useState(""),
    [company, setCompany] = useState("All"),
    [assignee, setAssignee] = useState("All"),
    [status, setStatus] = useState("All"),
    [priority, setPriority] = useState("All"),
    [project, setProject] = useState(""),
    [business, setBusiness] = useState("All"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [view, setView] = useState("All Tasks"),
    [editor, setEditor] = useState(null),
    [selected, setSelected] = useState([]),
    [bulkStatus, setBulkStatus] = useState("Open"),
    [bulkAssignee, setBulkAssignee] = useState("Unchanged"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
  }).format(new Date());
  let rows = data.tasks.filter(
    (t) =>
      (!search ||
        `${t.title} ${t.notes} ${t.details?.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (company === "All" ||
        (t.details?.company || brandOf(t, data)) === company) &&
      (assignee === "All" || t.assignee === assignee) &&
      (status === "All" || t.status === status) &&
      (priority === "All" || t.priority === priority) &&
      (!project ||
        `${t.details?.project || metadata(t).pageName || ""}`
          .toLowerCase()
          .includes(project.toLowerCase())) &&
      (business === "All" || t.business_id === business) &&
      (!start || t.due_date >= start) &&
      (!end || (t.due_date && t.due_date <= end)),
  );
  if (view === "My Tasks")
    rows = rows.filter((t) => t.assignee === member.display_name);
  if (view === "Completed Tasks")
    rows = rows.filter((t) => t.status === "Done");
  if (view === "Overdue Tasks")
    rows = rows.filter(
      (t) =>
        !["Done", "Cancelled"].includes(t.status) &&
        t.due_date &&
        t.due_date < today,
    );
  if (view === "Recurring Tasks")
    rows = rows.filter(
      (t) => t.details?.recurrence && t.details.recurrence !== "None",
    );
  rows.sort(
    (a, b) =>
      (a.due_date || "9999").localeCompare(b.due_date || "9999") ||
      a.title.localeCompare(b.title),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 50)),
    activePage = Math.min(page, pages),
    visible = rows.slice((activePage - 1) * 50, activePage * 50);
  function exportRows() {
    const url = URL.createObjectURL(
      new Blob(
        [
          toCsv(
            rows.map((t) => ({
              id: t.id,
              title: t.title,
              company: t.details?.company || brandOf(t, data),
              business:
                data.businesses.find((b) => b.id === t.business_id)?.name || "",
              project: t.details?.project || "",
              status: TASK_STATUSES[t.status],
              priority: t.priority,
              assignee: t.assignee,
              due_date: t.due_date,
              completed_at: t.completed_at,
              category: t.details?.category || "",
              recurrence: t.details?.recurrence || "",
            })),
          ),
        ],
        { type: "text/csv" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "master-tasks.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function bulk() {
    setBusy(true);
    setError("");
    let count = 0;
    try {
      for (const id of selected) {
        const t = data.tasks.find((t) => t.id === id);
        if (t) {
          await onSave("tasks", {
            ...t,
            status: bulkStatus,
            assignee: bulkAssignee === "Unchanged" ? t.assignee : bulkAssignee,
          });
          count++;
        }
      }
      setNotice(`${count} tasks updated.`);
      setSelected([]);
    } catch (e) {
      setError(`${count} tasks updated before an error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bi">
      <section className="card bi-no-print">
        <div className="section-head">
          <div>
            <h2>Master task management</h2>
            <p>
              Existing tasks and completion evidence preserved across all five
              companies.
            </p>
          </div>
          {writable && (
            <button className="primary" onClick={() => setEditor({})}>
              ＋ New task
            </button>
          )}
        </div>
        <div className="bi-tabs">
          {[
            "All Tasks",
            "My Tasks",
            "Company Tasks",
            "Calendar",
            "Overdue Tasks",
            "Completed Tasks",
            "Recurring Tasks",
          ].map((v) => (
            <button
              key={v}
              className={view === v ? "primary" : ""}
              onClick={() => {
                setView(v);
                setPage(1);
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {[
            ["Company", company, setCompany, ["All", ...BRANDS, "Unassigned"]],
            [
              "Assignee",
              assignee,
              setAssignee,
              [
                "All",
                ...new Set(data.tasks.map((t) => t.assignee || "Unassigned")),
              ],
            ],
            [
              "Status",
              status,
              setStatus,
              ["All", ...Object.keys(TASK_STATUSES)],
            ],
            [
              "Priority",
              priority,
              setPriority,
              ["All", "High", "Normal", "Low"],
            ],
          ].map(([label, value, set, values]) => (
            <label key={label}>
              {label}
              <select
                value={value}
                onChange={(e) => {
                  set(e.target.value);
                  setPage(1);
                }}
              >
                {values.map((v) => (
                  <option key={v} value={v}>
                    {TASK_STATUSES[v] || v}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Business
            <select
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
            >
              <option>All</option>
              {data.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Project
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </label>
          <label>
            Due from
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Due through
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button onClick={exportRows}>Export CSV</button>
          <button onClick={() => window.print()}>Print / Save PDF</button>
          {writable && (
            <>
              <button onClick={() => setSelected(visible.map((t) => t.id))}>
                Select this page
              </button>
              <label>
                Bulk status
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                >
                  {Object.entries(TASK_STATUSES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bulk assignee
                <select
                  value={bulkAssignee}
                  onChange={(e) => setBulkAssignee(e.target.value)}
                >
                  {["Unchanged", "Michelle", "Tim", "Unassigned"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button disabled={busy || !selected.length} onClick={bulk}>
                Apply to {selected.length} tasks
              </button>
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
      <section className="card">
        <h3>
          {view} · {rows.length} tasks
        </h3>
        {view === "Calendar" ? (
          <div className="bi-calendar">
            {[...new Set(visible.map((t) => t.due_date || "No due date"))].map(
              (day) => (
                <article key={day}>
                  <h3>{day}</h3>
                  {visible
                    .filter((t) => (t.due_date || "No due date") === day)
                    .map((t) => (
                      <p key={t.id}>
                        <button onClick={() => setEditor(t)}>{t.title}</button>
                        <small>
                          {t.assignee} · {TASK_STATUSES[t.status]}
                        </small>
                      </p>
                    ))}
                </article>
              ),
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="bi-no-print">Select</th>
                  <th>Task</th>
                  <th>Company / project</th>
                  <th>Person</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td className="bi-no-print">
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.title}`}
                        checked={selected.includes(t.id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, t.id]
                              : s.filter((id) => id !== t.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{t.title}</strong>
                      <small>
                        {t.details?.category || t.type} · {t.priority}
                      </small>
                      {t.details?.recurrence &&
                        t.details.recurrence !== "None" && (
                          <small>{t.details.recurrence}</small>
                        )}
                    </td>
                    <td>
                      {t.details?.company || brandOf(t, data) || "Unassigned"}
                      <small>
                        {t.details?.project || metadata(t).pageName || ""}
                      </small>
                      <small>
                        {
                          data.businesses.find((b) => b.id === t.business_id)
                            ?.name
                        }
                      </small>
                    </td>
                    <td>{t.assignee}</td>
                    <td>
                      {t.due_date || "None"}
                      {t.due_date &&
                        t.due_date < today &&
                        !["Done", "Cancelled"].includes(t.status) && (
                          <small>Overdue</small>
                        )}
                    </td>
                    <td>
                      {TASK_STATUSES[t.status]}
                      {t.completed_at && (
                        <small>Completed {t.completed_at.slice(0, 10)}</small>
                      )}
                    </td>
                    <td>
                      <button onClick={() => setEditor(t)}>
                        {writable ? "Edit" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions bi-no-print">
          <button
            disabled={activePage <= 1}
            onClick={() => setPage(activePage - 1)}
          >
            Previous
          </button>
          <span>
            Page {activePage} of {pages}
          </span>
          <button
            disabled={activePage >= pages}
            onClick={() => setPage(activePage + 1)}
          >
            Next
          </button>
        </div>
      </section>
      {editor && (
        <TaskEditor
          repository={repository}
          task={editor}
          data={data}
          writable={writable}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
