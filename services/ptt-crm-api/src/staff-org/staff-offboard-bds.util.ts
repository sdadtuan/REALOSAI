export type OffboardBdsCounts = {
  holds_released: number;
  holds_kept: number;
  tickets_reassigned: number;
};

const EMPTY: OffboardBdsCounts = {
  holds_released: 0,
  holds_kept: 0,
  tickets_reassigned: 0,
};

export async function runStaffOffboardBdsSideEffect(
  getHook: () => {
    onStaffOffboarded: (input: { crmStaffId: number }) => Promise<OffboardBdsCounts>;
  },
  crmStaffId: number | undefined | null,
): Promise<OffboardBdsCounts> {
  const id = Number(crmStaffId);
  if (!Number.isFinite(id) || id <= 0) return { ...EMPTY };
  try {
    const hook = getHook();
    return await hook.onStaffOffboarded({ crmStaffId: id });
  } catch {
    return { ...EMPTY };
  }
}
