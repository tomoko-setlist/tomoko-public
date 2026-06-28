import { formatDateRangeLabel } from "../../lib/searchDateRange";

type Join = "and" | "or";

type ConditionExpressionItem = {
  field: string;
  value: string;
  method: string;
};

type ConditionExpressionGroup = {
  conditionJoin?: Join;
  conditions: ConditionExpressionItem[];
};

type ConditionExpressionPreviewProps = {
  groups: ConditionExpressionGroup[];
  topLevelJoin?: Join;
  dateFrom?: string;
  dateTo?: string;
  getFieldLabel: (field: string) => string;
  getMethodLabel: (item: ConditionExpressionItem) => string;
  isNegativeMethod: (method: string) => boolean;
  getDisplayValue?: (item: ConditionExpressionItem) => string;
  className?: string;
};

const formatJoinLabel = (join: Join | undefined) => (join === "or" ? " または " : " かつ ");

function buildConditionExpressionPreview({
  groups,
  topLevelJoin = "and",
  dateFrom = "",
  dateTo = "",
  getFieldLabel,
  getMethodLabel,
  isNegativeMethod,
  getDisplayValue,
}: Omit<ConditionExpressionPreviewProps, "className">): string {
  const conditionGroupPreview = groups
    .map((group) => {
      const positives = group.conditions
        .filter((item) => !isNegativeMethod(item.method) && item.value.trim().length > 0)
        .map((item) => {
          const label = getFieldLabel(item.field);
          const value = getDisplayValue ? getDisplayValue(item) : item.value.trim();
          const methodLabel = getMethodLabel(item);
          return `「${label}：${value} ${methodLabel}」`;
        });

      const negatives = group.conditions
        .filter((item) => isNegativeMethod(item.method) && item.value.trim().length > 0)
        .map((item) => {
          const label = getFieldLabel(item.field);
          const value = getDisplayValue ? getDisplayValue(item) : item.value.trim();
          const methodLabel = getMethodLabel(item);
          return `「${label}：${value} ${methodLabel}」`;
        });

      const parts: string[] = [];
      const groupJoin = formatJoinLabel(group.conditionJoin);
      if (positives.length > 0) parts.push(positives.join(groupJoin));
      if (negatives.length > 0) parts.push(negatives.join(groupJoin));
      if (parts.length === 0) return "";

      const core = parts.length > 1 ? parts.join(" かつ ") : parts[0];
      return group.conditions.length > 1 ? `（${core}）` : core;
    })
    .filter((item) => item.length > 0)
    .join(formatJoinLabel(topLevelJoin));

  const dateConditionLabel = formatDateRangeLabel({
    dateFrom: dateFrom.trim(),
    dateTo: dateTo.trim(),
  });
  const dateConditionPreview = dateConditionLabel ? `「開催日：${dateConditionLabel}」` : "";

  return [conditionGroupPreview.length > 0 ? conditionGroupPreview : "", dateConditionPreview]
    .filter((item) => item.length > 0)
    .join(" かつ ");
}

export function ConditionExpressionPreview(props: ConditionExpressionPreviewProps) {
  const preview = buildConditionExpressionPreview(props);
  if (!preview) return null;

  return (
    <div className={props.className ?? "mt-3 rounded-none border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-[11px] text-slate-700"}>
      条件式: {preview}
    </div>
  );
}
