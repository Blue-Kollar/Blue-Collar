import type { Meta, StoryObj } from "@storybook/react";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import type { ColumnDef, RowAction, SortDirection } from "./Table";
import { Table } from "./Table";

interface Row {
  id: number;
  name: string;
  category: string;
  status: string;
  views: number;
}

const sampleData: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: `Worker ${i + 1}`,
  category: ["Plumber", "Electrician", "Carpenter"][i % 3],
  status: i % 3 === 0 ? "Inactive" : "Active",
  views: (i + 1) * 47,
}));

const columns: ColumnDef<Row>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "category", header: "Category", sortable: true },
  { key: "status", header: "Status" },
  { key: "views", header: "Views", sortable: true, hideOnMobile: true },
];

const actions: RowAction<Row>[] = [
  { label: "Edit", icon: <Pencil size={13} />, onClick: (r) => alert(`Edit ${r.name}`) },
  { label: "Delete", icon: <Trash2 size={13} />, onClick: (r) => alert(`Delete ${r.name}`), variant: "danger" },
];

const meta: Meta<typeof Table<Row>> = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Table<Row>>;

export const Default: Story = {
  render: () => <Table columns={columns} data={sampleData} aria-label="Workers" />,
};

export const WithActions: Story = {
  render: () => <Table columns={columns} data={sampleData} rowActions={actions} aria-label="Workers" />,
};

export const Selectable: Story = {
  render: () => {
    const [sel, setSel] = useState<Set<string | number>>(new Set());
    return (
      <Table
        columns={columns}
        data={sampleData}
        selectable
        selectedIds={sel}
        onSelectionChange={setSel}
        rowActions={actions}
        aria-label="Workers selectable"
      />
    );
  },
};

export const WithPagination: Story = {
  render: () => {
    const [page, setPage] = useState(1);
    return (
      <Table
        columns={columns}
        data={sampleData.slice((page - 1) * 3, page * 3)}
        total={sampleData.length}
        page={page}
        pageSize={3}
        onPageChange={setPage}
        aria-label="Workers paginated"
      />
    );
  },
};

export const WithSorting: Story = {
  render: () => {
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<SortDirection>("asc");
    const sorted = [...sampleData].sort((a, b) => {
      if (!sortKey) return 0;
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return (
      <Table
        columns={columns}
        data={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
        aria-label="Sortable workers"
      />
    );
  },
};

export const Loading: Story = {
  render: () => <Table columns={columns} data={[]} loading aria-label="Loading" />,
};

export const Empty: Story = {
  render: () => (
    <Table
      columns={columns}
      data={[]}
      emptyMessage="No workers found. Create your first listing."
      aria-label="Empty"
    />
  ),
};
