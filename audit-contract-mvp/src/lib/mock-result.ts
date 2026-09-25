import type { ReviewResult, ReviewRisk } from "@/lib/types";

export function buildMockReview(
  contractName: string,
  extras?: { gongsiming?: string; shenchamoshi?: string }
): ReviewResult {
  const company = extras?.gongsiming?.trim();
  const mode = extras?.shenchamoshi?.trim();
  const echoBits = [
    company ? `公司名「${company}」` : null,
    mode ? `审查模式「${mode}」` : null,
  ].filter(Boolean);
  const echo =
    echoBits.length > 0
      ? `本次示例入参：${echoBits.join("，")}。`
      : "";
  const raw = {
    summary: [
      "示例：采购框架协议。合同类型判断为货物采购；付款、验收、违约金与管辖条款需重点核对。此结果为本地固定样例，不是对该文件的真实审查。",
      echo,
    ]
      .filter(Boolean)
      .join(""),
    risks: [
      {
        id: "r1",
        level: "high",
        title: "付款条件缺少验收挂钩",
        detail:
          "约定签订后 15 日内支付 70% 预付款，但未将剩余款项与到货验收、质保期满挂钩，买方在货物不符时缺少合法拒付依据。",
        clauseRef: "第五条 付款方式",
      },
      {
        id: "r2",
        level: "high",
        title: "无限责任与过高违约金并存",
        detail:
          "卖方对间接损失承担无限责任，同时逾期交货按日 1% 计违约金且无上限，叠加后可能远超合同总价。",
        clauseRef: "第十二条 违约责任",
      },
      {
        id: "r3",
        level: "medium",
        title: "管辖约定不完整",
        detail:
          "仅写「由甲方所在地法院管辖」，未写清是否排除仲裁、是否包括保全与执行阶段，争议解决路径不清晰。",
        clauseRef: "第十六条 争议解决",
      },
      {
        id: "r4",
        level: "low",
        title: "保密期限短于合作周期",
        detail:
          "保密义务自签署日起 1 年届满，短于框架协议 3 年有效期，期满后技术参数仍可能被披露。",
        clauseRef: "第十四条 保密",
      },
    ] as ReviewRisk[],
    clauses: [
      {
        id: "c1",
        title: "合同类型",
        excerpt: "货物采购框架协议（示例判断）",
        comment: "适用买卖合同规则；若含安装调试，可能构成承揽或混合合同。",
      },
      {
        id: "c2",
        title: "付款",
        excerpt: "预付 70%，余款节点未与验收绑定。",
      },
      {
        id: "c3",
        title: "期限",
        excerpt: "框架有效期 3 年，单笔订单交货期 30 日。",
      },
      {
        id: "c4",
        title: "违约",
        excerpt: "逾期交货日万分之百计违约金，无上限；间接损失无限责任。",
      },
      {
        id: "c5",
        title: "管辖",
        excerpt: "甲方所在地人民法院。",
      },
      {
        id: "c6",
        title: "保密",
        excerpt: "保密期 1 年，短于合同有效期。",
      },
    ],
    suggestions: [
      {
        id: "s1",
        relatedRiskId: "r1",
        action:
          "将付款改为「到货验收合格后支付至 90%，质保期满无质量异议后支付尾款 10%」，并写明验收不合格时的拒付与退货权。",
      },
      {
        id: "s2",
        relatedRiskId: "r2",
        action:
          "将违约金上限约定为合同总价的 20%–30%，并排除可得利益、商誉等间接损失，或改为可预见损失范围内的赔偿。",
      },
      {
        id: "s3",
        relatedRiskId: "r3",
        action:
          "明确「排他性诉讼管辖」或改为仲裁（写清仲裁机构与规则），并覆盖合同效力、解除与侵权竞合争议。",
      },
    ],
  };

  return {
    contractName,
    source: "mock",
    summary: raw.summary,
    risks: raw.risks,
    clauses: raw.clauses,
    suggestions: raw.suggestions,
    rawText: JSON.stringify(raw, null, 2),
    partial: false,
  };
}
