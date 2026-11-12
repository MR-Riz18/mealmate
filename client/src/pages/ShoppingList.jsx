import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shoppingApi } from '../api';
import Navbar from '../components/Navbar';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const inputCls = 'field';

function mondayLabel(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ShoppingList() {
  const [params] = useSearchParams();
  const [lists, setLists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [week, setWeek] = useState(() => params.get('week') || mondayLabel());
  const [manual, setManual] = useState({ name: '', quantity: '', unit: '', category: '' });
  const [editing, setEditing] = useState({}); // itemId -> { name, quantity, unit }

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const d = await shoppingApi.list();
      setLists(d.lists || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const loadList = async (id) => {
    try {
      const d = await shoppingApi.get(id);
      setSelected(d);
    } catch (e) { setErr(e.message); }
  };

  const generate = async () => {
    setErr('');
    try {
      const d = await shoppingApi.generate({ weekStartDate: week });
      setSelected(d);
      await fetchLists();
    } catch (e) { setErr(e.message); }
  };

  const regenerate = async () => {
    if (!selected) return;
    try {
      const d = await shoppingApi.generate({ mealPlanId: selected.mealPlan, weekStartDate: selected.weekStartDate });
      setSelected(d);
      await fetchLists();
    } catch (e) { setErr(e.message); }
  };

  const toggleChecked = async (item) => {
    try {
      const d = await shoppingApi.patchItem(selected._id, item._id, { checked: !item.checked });
      setSelected(d);
    } catch (e) { setErr(e.message); }
  };

  const addManual = async (e) => {
    e.preventDefault();
    if (!selected || !manual.name.trim()) return;
    try {
      const d = await shoppingApi.addItem(selected._id, {
        name: manual.name.trim(),
        quantity: manual.quantity === '' ? null : Number(manual.quantity),
        unit: manual.unit.trim(),
        category: manual.category.trim() || undefined,
      });
      setSelected(d);
      setManual({ name: '', quantity: '', unit: '', category: '' });
    } catch (err2) { setErr(err2.message); }
  };

  const saveEdit = async (item) => {
    const draft = editing[item._id];
    if (!draft) return;
    try {
      const d = await shoppingApi.patchItem(selected._id, item._id, {
        name: draft.name, quantity: draft.quantity === '' ? null : Number(draft.quantity), unit: draft.unit,
      });
      setSelected(d);
      setEditing((prev) => { const next = { ...prev }; delete next[item._id]; return next; });
    } catch (e) { setErr(e.message); }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from the list?`)) return;
    try {
      const d = await shoppingApi.deleteItem(selected._id, item._id);
      setSelected(d);
    } catch (e) { setErr(e.message); }
  };

  const removeList = async () => {
    if (!selected || !window.confirm('Delete this shopping list?')) return;
    try {
      await shoppingApi.remove(selected._id);
      setSelected(null);
      await fetchLists();
    } catch (e) { setErr(e.message); }
  };

  const checkedCount = selected ? selected.items.filter((i) => i.checked).length : 0;
  const groups = selected?.groupedItems || {};
  const groupNames = Object.keys(groups).sort();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="print-area mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shopping list</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a list from a week's meal plan. Same-name, same-unit ingredients are combined;
          different units (grams vs cups) are never auto-converted and stay as separate lines.
          Items marked “In pantry” are still on the list — nothing is removed or subtracted automatically.
        </p>

        <div className="no-print mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4">
          <label className="text-sm text-slate-600">
            Week starting (Monday)
            <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button onClick={generate} className="btn-primary">Generate / regenerate for this week</button>
          {lists.length > 0 && (
            <label className="text-sm text-slate-600">
              Saved lists
              <select value={selected?._id || ''} onChange={(e) => loadList(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">Choose a list…</option>
                {lists.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.weekStartDate ? new Date(l.weekStartDate).toLocaleDateString() : 'Manual list'} · {l.items.length} items
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {err && <div className="no-print mt-4"><ErrorState message={err} onRetry={fetchLists} /></div>}

        {loading ? (
          <div className="mt-6"><CardSkeleton /></div>
        ) : !selected ? (
          <div className="mt-6"><EmptyState title="No shopping list selected" message="Generate one from a week's meal plan, or pick a saved list above." /></div>
        ) : (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600" aria-live="polite">
                {checkedCount} of {selected.items.length} purchased
                {selected.weekStartDate && ` · week of ${new Date(selected.weekStartDate).toLocaleDateString()}`}
              </p>
              <div className="no-print flex gap-2">
                <button onClick={regenerate} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Regenerate (keeps manual + checked items)</button>
                <button onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Print list</button>
                <button onClick={removeList} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">Delete list</button>
              </div>
            </div>

            <form onSubmit={addManual} className="no-print mt-4 grid gap-3 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4 sm:grid-cols-4">
              <input placeholder="Add an item manually…" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} className={inputCls} aria-label="Manual item name" />
              <input placeholder="Quantity (optional)" type="number" min="0" step="any" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} className={inputCls} aria-label="Manual item quantity" />
              <input placeholder="Unit (optional)" value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value })} className={inputCls} aria-label="Manual item unit" />
              <button type="submit" className="btn-primary">Add item</button>
            </form>

            {groupNames.length === 0 ? (
              <div className="mt-6"><EmptyState title="List is empty" message="Add items manually, or regenerate after adding meals to the plan." /></div>
            ) : groupNames.map((cat) => (
              <section key={cat} className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4">
                <h2 className="font-semibold capitalize text-slate-900">{cat}</h2>
                <ul className="mt-2 divide-y divide-slate-100">
                  {groups[cat].map((item) => {
                    const draft = editing[item._id];
                    return (
                      <li key={item._id} className="flex flex-wrap items-center gap-3 py-2">
                        <input type="checkbox" checked={!!item.checked} onChange={() => toggleChecked(item)} aria-label={`Mark ${item.name} purchased`} className="h-4 w-4" />
                        {draft ? (
                          <>
                            <input value={draft.name} onChange={(e) => setEditing((p) => ({ ...p, [item._id]: { ...draft, name: e.target.value } }))} className={`${inputCls} w-48`} aria-label="Edit item name" />
                            <input value={draft.quantity} onChange={(e) => setEditing((p) => ({ ...p, [item._id]: { ...draft, quantity: e.target.value } }))} className={`${inputCls} w-24`} aria-label="Edit item quantity" />
                            <input value={draft.unit} onChange={(e) => setEditing((p) => ({ ...p, [item._id]: { ...draft, unit: e.target.value } }))} className={`${inputCls} w-24`} aria-label="Edit item unit" />
                            <button onClick={() => saveEdit(item)} className="btn-primary px-3 py-1.5 text-xs">Save</button>
                            <button onClick={() => setEditing((p) => { const n = { ...p }; delete n[item._id]; return n; })} className="rounded-lg border px-3 py-1.5 text-xs">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className={`flex-1 text-sm ${item.checked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                              {item.name}
                              {item.quantity != null && ` — ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}
                              {item.manual && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">manual</span>}
                              {item.inPantry && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">In pantry</span>}
                            </span>
                            <button onClick={() => setEditing((p) => ({ ...p, [item._id]: { name: item.name, quantity: item.quantity ?? '', unit: item.unit || '' } }))} className="no-print rounded-lg border px-2 py-1 text-xs">Edit</button>
                            <button onClick={() => removeItem(item)} className="no-print rounded-lg border px-2 py-1 text-xs text-red-700">Remove</button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
