export type BenchmarkTaskCategory =
  | "travel-planning"
  | "customer-support"
  | "product-requirement-clarification"
  | "data-analysis"
  | "coding-assistant"
  | "meeting-summarization"
  | "product-recommendation"
  | "budget-planning"
  | "multi-constraint-decision-making"
  | "agent-self-correction";

export type BenchmarkTaskDifficulty = "easy" | "medium" | "hard";

export type BenchmarkTool =
  | "calculator"
  | "mockSearch"
  | "productDb"
  | "calendar";

export type BenchmarkTaskDefinition = {
  id: string;
  title: string;
  category: BenchmarkTaskCategory;
  difficulty: BenchmarkTaskDifficulty;
  initialPrompt: string;
  userGoal: string;
  expectedOutcome: string;
  followUpTurns: string[];
  suggestedTools: BenchmarkTool[];
  evaluationRubric: {
    successCriteria: string[];
    failureModes: string[];
    scoringNotes: string;
  };
};

type TaskSeed = {
  id: string;
  title: string;
  category: BenchmarkTaskCategory;
  difficulty: BenchmarkTaskDifficulty;
  initialPrompt: string;
  userGoal: string;
  expectedOutcome: string;
  followUpTurns: string[];
  suggestedTools: BenchmarkTool[];
  scoringFocus: string;
};

function buildRubric(seed: TaskSeed): BenchmarkTaskDefinition["evaluationRubric"] {
  const successByCategory: Record<
    BenchmarkTaskCategory,
    string[]
  > = {
    "travel-planning": [
      "给出可执行的行程顺序，而不是零散建议。",
      "能够在后续约束出现后同步调整时间、预算和路线。",
      "解释住宿、交通、节奏和体验之间的取舍。",
    ],
    "customer-support": [
      "先识别缺失事实，再做退款、补偿或升级判断。",
      "在用户补充订单、会员或政策细节后保持口径一致。",
      "输出适合直接发送给用户的清晰回复和处理建议。",
    ],
    "product-requirement-clarification": [
      "通过追问澄清用户、场景、目标和非目标，而不是直接写模板。",
      "把零散输入收敛为范围、流程和成功指标都明确的需求描述。",
      "能指出风险、依赖和仍待确认的问题。",
    ],
    "data-analysis": [
      "区分已知事实、推测原因和待验证假设。",
      "根据新增切片或口径变化及时修正分析结论。",
      "最后给出可执行的下一步分析或业务动作建议。",
    ],
    "coding-assistant": [
      "优先请求关键日志、代码或复现场景，而不是随机猜测。",
      "随着新信息出现更新诊断思路。",
      "同时给出修复建议和验证方案。",
    ],
    "meeting-summarization": [
      "明确区分结论、待办和未决事项。",
      "对冲突信息保持谨慎，不擅自补全确定性。",
      "输出结构清晰、便于转发和跟进。",
    ],
    "product-recommendation": [
      "先补齐最关键的需求约束，再做推荐。",
      "比较不同方案并解释原因，而不是直接罗列产品。",
      "在预算、偏好或使用场景变化后保持推荐逻辑连贯。",
    ],
    "budget-planning": [
      "区分固定支出、可变支出和可裁剪支出。",
      "在预算目标变化后重新排序优先级。",
      "解释数字背后的业务影响，而不只是给表格。",
    ],
    "multi-constraint-decision-making": [
      "同时跟踪多个约束，不只优化单一目标。",
      "随着利益相关方新增要求而更新比较框架。",
      "输出结论时保留残余风险和待确认事项。",
    ],
    "agent-self-correction": [
      "明确承认误解并重述更正后的目标。",
      "停止沿用错误前提，后续回答与新上下文一致。",
      "修正后继续推进任务，而不是只停留在道歉。",
    ],
  };

  const failuresByCategory: Record<
    BenchmarkTaskCategory,
    string[]
  > = {
    "travel-planning": [
      "忽略后续新增的时间、预算、同行人或签证限制。",
      "行程节奏明显不现实，或交通衔接无法落地。",
      "只给景点清单，没有形成连续决策。",
    ],
    "customer-support": [
      "信息不完整时过早承诺结果。",
      "用户补充细节后前后结论矛盾。",
      "沟通语气生硬，或没有给出下一步动作。",
    ],
    "product-requirement-clarification": [
      "直接套 PRD 模板，没有处理真实歧义。",
      "默认关键假设，缺少澄清问题。",
      "没有把目标、指标和边界讲清楚。",
    ],
    "data-analysis": [
      "过早锁定单一根因。",
      "忽略分群、口径变化或埋点不确定性。",
      "最后只给泛泛建议，没有结合当前线索。",
    ],
    "coding-assistant": [
      "在缺少证据时给出拍脑袋修复方案。",
      "忽略异步、重试、缓存或持久化等常见链路问题。",
      "没有说明如何验证修复是否生效。",
    ],
    "meeting-summarization": [
      "把讨论中的猜测写成已确认结论。",
      "遗漏 owner、截止时间或关键争议点。",
      "输出大段散文，难以直接复用。",
    ],
    "product-recommendation": [
      "没有先澄清预算、偏好或核心用途。",
      "后续约束变化后推荐逻辑断裂。",
      "只会堆参数，不会做优先级判断。",
    ],
    "budget-planning": [
      "把所有预算项都当成同等可调整。",
      "假设变化后没有重新计算和排序。",
      "只有数字没有决策解释。",
    ],
    "multi-constraint-decision-making": [
      "过早选定答案，没有展开比较。",
      "一旦复杂度上升就丢掉某个约束。",
      "结论模糊，无法看出为什么这样选。",
    ],
    "agent-self-correction": [
      "为错误辩解，或只道歉不修正。",
      "明知已纠正仍重复原来的错误假设。",
      "纠正后没有真正继续推进用户目标。",
    ],
  };

  return {
    successCriteria: successByCategory[seed.category],
    failureModes: failuresByCategory[seed.category],
    scoringNotes: seed.scoringFocus,
  };
}

function createTask(seed: TaskSeed): BenchmarkTaskDefinition {
  return {
    ...seed,
    evaluationRubric: buildRubric(seed),
  };
}

function createTasks(seeds: TaskSeed[]) {
  return seeds.map(createTask);
}

const travelPlanningTasks = createTasks([
  {
    id: "travel-japan-family-rail",
    title: "预算内的日本亲子铁路行程",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "帮我规划一个 8 天日本亲子行程，我们一家三口从上海出发，想坐新干线，预算不能太高。",
    userGoal:
      "得到一份会随着航班时间、孩子作息和酒店位置变化而继续调整的真实旅行方案。",
    expectedOutcome:
      "一份可执行的多轮行程规划，兼顾交通衔接、亲子节奏、预算和住宿选择。",
    followUpTurns: [
      "我们第一天要到晚上九点才落地东京，第二天不想起太早。",
      "孩子对动物园很感兴趣，但我不想每天都换酒店。",
      "总预算最多 2.5 万人民币，能不能把京都缩短一天？",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "优秀答案应像真实旅行顾问一样，随着到达时间、家庭节奏和预算变化不断重排路线。",
  },
  {
    id: "travel-southeast-asia-remote-work",
    title: "东南亚远程办公兼休假安排",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "我想在东南亚待 10 天，一半时间远程办公，一半时间休假，帮我安排行程。",
    userGoal:
      "在住宿网络、跨城效率和休闲体验之间做平衡，并且能应对用户后续临时加班安排。",
    expectedOutcome:
      "一套明确区分办公日和休假日的行程，并说明换城节奏和备选方案。",
    followUpTurns: [
      "我每天上午都要开视频会，所以住宿的网络一定要稳定。",
      "我不想带太多行李，如果换城市最好不超过两次。",
      "第三天临时多了一场客户会，白天最好不要安排浮潜。",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "重点看是否能把办公约束真正融进行程，而不是先写旅游计划再临时打补丁。",
  },
  {
    id: "travel-europe-honeymoon-visa-window",
    title: "签证窗口紧张的欧洲蜜月路线",
    category: "travel-planning",
    difficulty: "hard",
    initialPrompt:
      "我们计划 12 天欧洲蜜月旅行，但签证时间很紧，想去两到三个国家，帮我排一下。",
    userGoal:
      "在浪漫体验、签证可行性、跨国交通和预算之间找到稳妥方案。",
    expectedOutcome:
      "给出兼顾签证办理可行性和旅行体验的路线，并明确说明为什么不适合贪多。",
    followUpTurns: [
      "我们大概只有 3 周准备时间，如果签证风险大就尽量少换国家。",
      "希望至少安排两晚景色好的酒店，但总预算不能失控。",
      "返程必须从巴黎飞回上海，这会不会影响整体顺路程度？",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "高分答案会主动压缩不现实的愿望清单，把签证和交通顺路性作为核心约束。",
  },
  {
    id: "travel-pet-friendly-weekend",
    title: "带宠物的周边周末短途",
    category: "travel-planning",
    difficulty: "easy",
    initialPrompt:
      "我想从杭州出发，周末带狗自驾去两天一夜，帮我想一个轻松点的路线。",
    userGoal:
      "找到真正对宠物友好、车程不过分累、并且天气不好也能调整的方案。",
    expectedOutcome:
      "一个节奏舒适的短途计划，说明宠物限制、雨天备选和出发返程安排。",
    followUpTurns: [
      "单程最好不要超过 3 小时，我家狗坐车太久会焦虑。",
      "如果下雨，希望还有能带宠物的室内备选。",
      "我们周日晚上八点前必须回到杭州。",
    ],
    suggestedTools: ["mockSearch", "calendar"],
    scoringFocus:
      "关键在于把宠物出行限制和返程时间真正变成路线约束，而不是附带提一下。",
  },
  {
    id: "travel-us-west-coast-roadtrip",
    title: "美国西海岸多人自驾分工路线",
    category: "travel-planning",
    difficulty: "hard",
    initialPrompt:
      "我们四个朋友要去美国西海岸自驾 9 天，想看海岸线也想进国家公园，帮我安排行程。",
    userGoal:
      "在多人偏好、驾驶强度、住宿成本和景点密度之间做取舍，并处理临时意见变化。",
    expectedOutcome:
      "一份兼顾驾驶距离、住宿切换和景点优先级的多人自驾计划。",
    followUpTurns: [
      "其中一个人不太能接受连续长途驾驶，单天最好不要超过 5 小时。",
      "我们希望至少有一天安排在海边放松，不要天天赶景点。",
      "其中两个人临时想加优胜美地，但如果太绕也可以放弃。",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "重点考察是否能主动控制驾驶强度，并在多人偏好冲突时解释为什么舍弃某些点。",
  },
  {
    id: "travel-yunnan-senior-friendly",
    title: "适合长辈的云南慢节奏线路",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "我想带爸妈去云南玩 6 天，他们年纪大了，不能太累，帮我排一下。",
    userGoal:
      "获得一份节奏慢、海拔和换酒店频率都可控的长辈友好型路线。",
    expectedOutcome:
      "一套优先考虑体力、海拔适应和医疗便利性的多轮旅行建议。",
    followUpTurns: [
      "我妈膝盖不太好，尽量少安排太多台阶和徒步。",
      "我爸第一次去高海拔地区，最好别一上来就特别高。",
      "如果丽江和大理只能选一个，你会怎么建议？",
    ],
    suggestedTools: ["mockSearch", "calendar"],
    scoringFocus:
      "高分答案会把健康风险和节奏管理放在景点数量之前，而不是默认经典打卡路线。",
  },
  {
    id: "travel-hongkong-typhoon-backup",
    title: "香港台风季的备选旅行安排",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "我下个月去香港 4 天，但正好是台风季，想提前做好 A 计划和 B 计划。",
    userGoal:
      "让行程具备天气弹性，减少受航班和户外景点关闭影响的风险。",
    expectedOutcome:
      "一个包含晴天、雨天和航班延误备选的短途城市方案。",
    followUpTurns: [
      "我第一天下午才到，而且不想一到就跑很远。",
      "如果迪士尼那天大雨，希望能立刻换成室内方案。",
      "返程前一晚我还得预留时间买伴手礼。",
    ],
    suggestedTools: ["mockSearch", "calendar"],
    scoringFocus:
      "要看答案是否真正把天气不确定性编进计划，而不是最后单独补一句“下雨就改室内”。",
  },
  {
    id: "travel-singapore-study-tour-budget",
    title: "学生团的新加坡学习参访安排",
    category: "travel-planning",
    difficulty: "hard",
    initialPrompt:
      "我要帮 12 个高中生安排 5 天新加坡学习参访，既要有学校参观，也要控制预算。",
    userGoal:
      "平衡团体管理、教育价值、城市移动效率和餐宿成本。",
    expectedOutcome:
      "一份适合学生团执行的参访日程，说明交通组织、集合节奏和预算控制方式。",
    followUpTurns: [
      "其中有两位学生素食，午餐安排要能兼顾。",
      "老师希望至少安排一次大学校园参观和一次企业参访。",
      "最后一天上午就得去机场，前一晚别排太满。",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "好答案会像带团负责人一样考虑团体节奏和组织成本，而不是只堆景点和机构名称。",
  },
  {
    id: "travel-hokkaido-ski-equipment",
    title: "北海道滑雪新手行程与装备安排",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "我们两个滑雪新手想去北海道玩 7 天，既想体验滑雪也想逛街吃东西，怎么安排比较好？",
    userGoal:
      "让滑雪体验、交通转场、装备租赁和非滑雪活动节奏更平衡。",
    expectedOutcome:
      "一份适合新手的滑雪旅行方案，并提前处理租赁、休息和天气变化问题。",
    followUpTurns: [
      "我们不想每天都滑雪，连续两天已经是极限了。",
      "如果暴雪导致上山不方便，希望还有城市备选安排。",
      "想住得舒服一点，但总预算不要比原计划高太多。",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "关注点是新手体验管理，尤其是滑雪强度、租赁便利和天气风险的联动调整。",
  },
  {
    id: "travel-greater-bay-business",
    title: "大湾区多城商务出差拼接",
    category: "travel-planning",
    difficulty: "hard",
    initialPrompt:
      "我下周要去深圳、广州和香港见客户，只有 4 天，帮我把商务出差和休息安排得顺一点。",
    userGoal:
      "在跨城交通、会议窗口、酒店切换和晚间休息之间做最小折腾的规划。",
    expectedOutcome:
      "一套以会议成功率和跨城效率为优先的商务行程安排。",
    followUpTurns: [
      "香港客户只能约在第三天下午，所以前两天最好把内地行程排满。",
      "我不想每天都换酒店，如果可以希望只住两个地方。",
      "每天晚上还得留一点时间准备第二天的材料。",
    ],
    suggestedTools: ["calendar", "mockSearch", "calculator"],
    scoringFocus:
      "高分答案需要体现商务优先级，知道什么时候牺牲景点和舒适度来换取会议成功率。",
  },
  {
    id: "travel-spain-muslim-friendly",
    title: "西班牙穆斯林友好路线设计",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "我和朋友想去西班牙玩 9 天，我们都比较在意清真餐和行程节奏，帮我规划一下。",
    userGoal:
      "让饮食约束、城市选择、移动效率和经典体验之间形成平衡。",
    expectedOutcome:
      "一份对饮食限制真正友好的城市线路，而不是事后补充几句提醒。",
    followUpTurns: [
      "我们不想为了打卡天天早起赶车，更希望行程舒服一点。",
      "如果某个城市清真餐选择太少，可以考虑减少停留时间。",
      "回程必须从巴塞罗那出发，能不能别走回头路？",
    ],
    suggestedTools: ["mockSearch", "calendar"],
    scoringFocus:
      "重点看是否把餐饮限制与路线设计结合起来，而不是只在结尾提醒“注意提前查餐厅”。",
  },
  {
    id: "travel-new-zealand-campervan",
    title: "新西兰房车自驾节奏安排",
    category: "travel-planning",
    difficulty: "hard",
    initialPrompt:
      "我们想去新西兰南岛开房车 8 天，但都是第一次开房车，帮我排一条不要太赶的线。",
    userGoal:
      "兼顾新手驾驶安全、营地节奏、风景优先级和天气变化。",
    expectedOutcome:
      "一条适合房车新手执行的慢节奏自驾线路，并明确说明不该贪多的地方。",
    followUpTurns: [
      "我们不希望每天都开太久，最好控制在 3 到 4 小时。",
      "如果某两段路况比较复杂，希望你直接建议放弃其中一个点。",
      "想安排一次观星，但不要因此把整天行程弄得特别累。",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "优秀答案会像房车领队一样主动删减高风险路线，而不是为了覆盖更多景点硬拼行程。",
  },
]);

const customerSupportTasks = createTasks([
  {
    id: "support-delay-refund-giftcard",
    title: "延迟发货叠加礼品卡的退款处理",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户买的耳机发货延迟了 9 天，现在想退款，但订单里还用了礼品卡和满减券，客服该怎么回复？",
    userGoal:
      "得到一个既符合政策又不刺激用户情绪的处理方案，并能随着订单细节继续修正。",
    expectedOutcome:
      "一套清晰的处理路径，说明应退金额、礼品卡影响、是否需要升级和话术建议。",
    followUpTurns: [
      "用户说商品昨天其实已经签收了，但包装有点破损。",
      "用户是高级会员，过去半年有多次大额消费记录。",
      "政策规定签收后非质量问题不能全额退款，这时应该怎么安抚？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "重点考察是否会先确认关键事实，并在促销、礼品卡和会员补偿之间保持规则一致。",
  },
  {
    id: "support-damaged-device-warranty",
    title: "设备轻微进水后的保修边界判断",
    category: "customer-support",
    difficulty: "hard",
    initialPrompt:
      "用户说刚买两个月的平板突然黑屏了，但售后检测里提到可能有轻微进水痕迹，客服怎么处理？",
    userGoal:
      "判断是否能直接保修、部分承担还是需要升级人工复核，并给出可发出的解释。",
    expectedOutcome:
      "一个兼顾保修政策、证据不足和用户体验的处理建议。",
    followUpTurns: [
      "用户坚持说从来没有进过水，还发来一张没有外观损伤的照片。",
      "检测点不是官方直营网点，而是授权合作门店。",
      "如果最终不能直接免费换新，至少还能提供什么补偿或补救路径？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "高分答案应处理好证据不充分的灰区，而不是简单站在用户或售后一边。",
  },
  {
    id: "support-subscription-double-charge",
    title: "订阅双重扣费与套餐切换争议",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户投诉本月被扣了两次会员费，说自己只是把月付换成了年付，这种情况客服怎么解释和处理？",
    userGoal:
      "厘清计费切换逻辑、确认是否重复扣费，并输出能直接发送的解释口径。",
    expectedOutcome:
      "一个既说明系统计费机制又能给出补救动作的客服回复。",
    followUpTurns: [
      "用户是在苹果内购里改的套餐，但我们后台也看到一次官网续费尝试。",
      "用户已经把账单截图发过来了，情绪比较激动。",
      "如果两个渠道同时生效，应该建议哪一边退款更快？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "看是否能把多渠道订阅问题解释清楚，并且给用户一个最短的处理路径。",
  },
  {
    id: "support-loyalty-points-missing",
    title: "促销后积分未到账的补登处理",
    category: "customer-support",
    difficulty: "easy",
    initialPrompt:
      "用户说活动期间买了东西，但承诺的双倍积分一直没到账，应该怎么处理？",
    userGoal:
      "快速核对活动规则、到账时点和异常情况，并给出明确回复。",
    expectedOutcome:
      "一段清楚说明规则、状态和下一步动作的客服答复。",
    followUpTurns: [
      "活动说明里写的是确认收货后 72 小时内到账。",
      "用户是分两笔下单的，其中一笔后来部分退款了。",
      "如果积分确实少发了，应该怎么补登并说明原因？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "重点在于是否能把到账时点和部分退款的影响解释清楚，避免机械回复。",
  },
  {
    id: "support-hotel-date-change",
    title: "酒店预订改期与差价争议",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户订的酒店日期填错了，入住前 4 天才发现，现在要求免费改期，客服应该怎么处理？",
    userGoal:
      "在酒店规则、平台补贴和用户满意度之间找到合适方案。",
    expectedOutcome:
      "一套说明能否改期、差价由谁承担、是否需要升级供应商的处理建议。",
    followUpTurns: [
      "订单显示的是不可取消，但用户说是给父母订的，不熟悉下单流程。",
      "新日期的房价比原来高 20%，酒店端暂时不愿豁免差价。",
      "如果不能免费改，怎么给出用户还能接受的替代方案？",
    ],
    suggestedTools: ["mockSearch", "calendar", "calculator"],
    scoringFocus:
      "好答案会同时考虑酒店政策和平台补偿空间，而不是一句“按规则不能改”。",
  },
  {
    id: "support-chargeback-risk-review",
    title: "高风险拒付前的客户沟通",
    category: "customer-support",
    difficulty: "hard",
    initialPrompt:
      "用户说银行卡出现异常扣款，准备直接找银行拒付，但订单其实已经发货了，客服现在怎么跟进？",
    userGoal:
      "尽量在升级到拒付前稳定用户情绪、核对事实并降低业务损失。",
    expectedOutcome:
      "一个兼顾风控、物流状态和沟通节奏的处理建议。",
    followUpTurns: [
      "用户说不是本人下单，但收货地址和历史订单地址一致。",
      "物流显示快递已经在派送途中，无法直接拦截。",
      "如果最终要走拒付流程，客服前置沟通应该留哪些关键信息？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点看能否在敏感风险场景下既保护用户体验，也避免过早做出不可逆承诺。",
  },
  {
    id: "support-vip-shipping-upgrade",
    title: "VIP 用户加急配送失约补偿",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "一个 VIP 用户买了生日礼物并加钱选了次日达，但物流没赶上，客服现在要怎么补偿？",
    userGoal:
      "在加急服务承诺失约的情况下给出合理补偿，并处理后续取消或继续签收的分支。",
    expectedOutcome:
      "一套兼顾赔付规则、会员等级和情绪安抚的应对方式。",
    followUpTurns: [
      "用户说如果今天下午前送不到就没意义了，可能直接拒收。",
      "订单里还有一件商品已经单独签收，不能整体撤回。",
      "如果补偿金额有限，怎么解释才不会显得很敷衍？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "高分答案应把服务失约、拆单签收和会员体验放在同一个决策框架里。",
  },
  {
    id: "support-invoice-tax-info-change",
    title: "发票税号修改与重开限制",
    category: "customer-support",
    difficulty: "easy",
    initialPrompt:
      "用户开票时填错了公司税号，现在发票已经开出来了，客服应该怎么回复？",
    userGoal:
      "明确重开发票的条件、时间窗口和用户需要补充的材料。",
    expectedOutcome:
      "一个操作步骤清晰、对限制说得明白的客服答复。",
    followUpTurns: [
      "用户已经把发票报销失败截图发过来了，希望今天内解决。",
      "原发票是电子普票，但现在财务要求专票。",
      "如果不能直接改票，客服要怎么解释并给出替代路径？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "看是否能用简单语言讲清楚财税限制，并且明确下一步需要用户做什么。",
  },
  {
    id: "support-preorder-split-shipment",
    title: "预售商品拆单发货后的取消争议",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户预售买了两件商品，现在其中一件先发货了，另一件延期，用户想整单取消，客服怎么处理？",
    userGoal:
      "处理预售规则、拆单状态和退款口径，避免用户认为平台在故意拖延。",
    expectedOutcome:
      "一个针对拆单和预售说明都比较完整的处理建议。",
    followUpTurns: [
      "活动页面写的是“可能分批发货”，但用户说自己下单时没注意到。",
      "已经发出的那件商品明天就会签收，另一件至少还要等一周。",
      "如果用户要求补偿运费或优惠券，客服应该怎么判断？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "关键在于把预售承诺和拆单现实讲明白，并处理“部分取消”这种常见灰区。",
  },
  {
    id: "support-account-lock-2fa",
    title: "二次验证失败导致账户锁定",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户因为多次输入错误验证码被锁号了，但他现在急着下载合同，客服应该怎么办？",
    userGoal:
      "在账号安全和业务紧急性之间做平衡，给出身份核验和解锁路径。",
    expectedOutcome:
      "一套既安全又高效的账户恢复处理方式。",
    followUpTurns: [
      "用户原来绑定的手机号已经不用了，现在收不到验证码。",
      "他能提供营业执照和最近一次付款记录截图。",
      "如果今天必须拿到合同，除了解锁还有没有别的安全替代方案？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点是既不牺牲账户安全，也能给出业务紧急情况下的可落地替代路径。",
  },
  {
    id: "support-group-buy-cancel-edge",
    title: "拼团失败与优惠返还边界",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "用户参加拼团后一直没成团，现在活动结束了，用户除了退款还想保留当时的优惠价，客服怎么回复？",
    userGoal:
      "解释拼团失败后的默认规则，同时判断平台是否有补偿空间。",
    expectedOutcome:
      "一份把退款、优惠失效和补偿选项讲清楚的客服回复。",
    followUpTurns: [
      "用户是第一次下单，截图里能看到活动页写了“成团失败自动退款”。",
      "用户表示自己拉了很多朋友，觉得平台应该补回折扣。",
      "如果客服只能给小额优惠券，怎么表达才不显得推脱？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "好答案会尊重活动规则，同时在用户心理预期管理上更细致，而不是生硬引用条款。",
  },
  {
    id: "support-b2b-sla-credit",
    title: "企业客户 SLA 违约积分补偿",
    category: "customer-support",
    difficulty: "hard",
    initialPrompt:
      "企业客户说我们本月连续两次工单响应超时，要求按合同返还服务积分，客服成功团队该怎么处理？",
    userGoal:
      "核对 SLA 条款、超时范围和补偿上限，并给出对外沟通方案。",
    expectedOutcome:
      "一个兼顾合同严谨性和续约关系的处理建议。",
    followUpTurns: [
      "其中一次超时发生在节假日值班期间，合同里对节假日条款写得有点模糊。",
      "客户马上要续约，销售希望客服不要先把补偿说死。",
      "如果需要升级法务或客户成功经理，应该由谁先出面？",
    ],
    suggestedTools: ["mockSearch", "calculator", "calendar"],
    scoringFocus:
      "重点考察对 B2B 条款、关系维护和内部协同顺序的判断，不只是算赔偿金额。",
  },
]);

const prdClarificationTasks = createTasks([
  {
    id: "prd-ai-meeting-summary",
    title: "AI 会议纪要功能需求澄清",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "我们想做一个 AI 会议纪要功能，你帮我整理成 PRD 吧。",
    userGoal:
      "通过多轮追问，把模糊想法收敛到目标用户、入口场景、输出格式和成功指标上。",
    expectedOutcome:
      "一份围绕真实场景展开的需求摘要，而不是空泛的功能列表。",
    followUpTurns: [
      "主要给销售团队用，他们最在意会后跟进和客户承诺提取。",
      "我们现在只有录音转写，没有视频，也不想一开始支持所有会议平台。",
      "老板希望能证明这个功能真的提高了会后跟进效率。",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "看是否先明确用户价值和工作流，再谈功能形态，而不是一上来就堆模板模块。",
  },
  {
    id: "prd-crm-alerts",
    title: "CRM 异常提醒能力定义",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "销售主管想要一个 CRM 异常提醒功能，能告诉他哪些客户可能流失，你帮我整理需求。",
    userGoal:
      "明确提醒对象、触发信号、接收人、误报容忍度和后续动作。",
    expectedOutcome:
      "一份围绕业务决策而不是算法想象的 PRD 草稿。",
    followUpTurns: [
      "主管不想看到太多噪音提醒，宁可少一点但准一点。",
      "一线销售更希望在客户详情页里看到原因，而不是只收到一个红点。",
      "如果后续要和企微通知打通，第一期应该留什么扩展位？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点是把“提醒”定义成可执行动作链，而不是模糊地说做一个流失预警模型。",
  },
  {
    id: "prd-self-service-returns",
    title: "用户自助退货流程梳理",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "运营想做一个用户自助退货入口，减少客服压力，帮我写需求。",
    userGoal:
      "厘清哪些订单可自助、哪些必须人工介入，以及如何平衡体验和风控。",
    expectedOutcome:
      "一个明确区分边界场景、关键节点和指标的需求说明。",
    followUpTurns: [
      "高客单商品和生鲜商品的退货规则明显不一样。",
      "运营希望第一期就能看到退货原因分布，但研发担心流程太复杂。",
      "如果用户提交退货后又想改地址或改原因，该不该支持？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "高分答案需要主动拆边界，不把所有退货场景当成同一条流程。",
  },
  {
    id: "prd-b2b-approval-flow",
    title: "B2B 折扣审批流需求收敛",
    category: "product-requirement-clarification",
    difficulty: "hard",
    initialPrompt:
      "销售团队说要做一个更灵活的折扣审批流，你帮我整理一下这件事到底要做什么。",
    userGoal:
      "挖清审批发起条件、层级差异、例外情况和审计需求。",
    expectedOutcome:
      "一份能把审批路径、角色权限和异常处理说清楚的需求摘要。",
    followUpTurns: [
      "不同区域负责人审批权限不一样，有的能批到 15%，有的只能批到 10%。",
      "财务要求所有例外审批都能追溯是谁为什么批准的。",
      "销售希望手机端也能快速审批，但研发不想首期做完整移动端流程。",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "要看是否能把审批流当成权限和责任链问题来处理，而不是单纯画流程框。",
  },
  {
    id: "prd-ai-search-knowledge",
    title: "内部知识库 AI 搜索范围定义",
    category: "product-requirement-clarification",
    difficulty: "hard",
    initialPrompt:
      "我们想做一个公司内部知识库 AI 搜索，大家说需求很多，你帮我先整理一下。",
    userGoal:
      "优先厘清首批用户、可搜索数据源、可信度表达和权限限制。",
    expectedOutcome:
      "一个范围可控、能落地的 AI 搜索需求框架。",
    followUpTurns: [
      "客服团队最先会用，但法务文档和销售文档的权限不一样。",
      "管理层很想要“直接给答案”，但知识库内容经常过期。",
      "如果首期只接入两个数据源，应该怎么选才最有价值？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点是处理权限和可信度问题，而不是简单把“AI 搜索”理解成换个输入框。",
  },
  {
    id: "prd-creator-campaign-brief",
    title: "达人投放 Brief 自动生成需求",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "市场团队想要一个自动生成达人投放 Brief 的工具，帮我整理需求。",
    userGoal:
      "弄清输入来源、输出结构、人工修改环节和复用方式。",
    expectedOutcome:
      "一份围绕真实投放流程的需求说明，而不是泛化的 AI 写作工具描述。",
    followUpTurns: [
      "团队希望先从新品首发 Brief 开始，不想一开始覆盖所有活动类型。",
      "运营同事一定会手改文案，所以系统最好能保留可编辑结构。",
      "如果不同品牌调性不同，第一期应该怎么处理模板差异？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "优秀答案会围绕“谁来输入、谁来修改、谁来复用”来定义需求，而不是只谈生成质量。",
  },
  {
    id: "prd-warehouse-exception-center",
    title: "仓储异常处理工作台需求",
    category: "product-requirement-clarification",
    difficulty: "hard",
    initialPrompt:
      "仓库团队想做一个异常处理工作台，解决拣货错误、缺货和包裹拦截问题，帮我整理 PRD。",
    userGoal:
      "通过追问梳理异常类型、优先级、处理角色和状态流转。",
    expectedOutcome:
      "一份能支撑排期和流程设计的仓储异常需求概要。",
    followUpTurns: [
      "现在最大痛点是异常分散在表格、IM 和工单里，大家来回切。",
      "不是所有异常都要仓库自己处理，有的要找客服，有的要找采购。",
      "如果首期只能先做一类异常，你会建议先抓哪类？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点看是否会先定义异常分类和协作链路，而不是直接进入界面字段层面。",
  },
  {
    id: "prd-finance-close-copilot",
    title: "财务关账 Copilot 需求澄清",
    category: "product-requirement-clarification",
    difficulty: "hard",
    initialPrompt:
      "财务负责人说想要一个关账 Copilot，能帮团队更快完成月结，你先帮我整理需求。",
    userGoal:
      "厘清它到底是提醒、核对、生成解释还是自动化处理，以及风险边界。",
    expectedOutcome:
      "一份把高风险动作和可先行落地动作区分清楚的 PRD 摘要。",
    followUpTurns: [
      "财务不接受系统自动过账，但希望系统能先帮忙找差异和生成解释草稿。",
      "每个子公司关账口径略有不同，这会影响规则配置。",
      "如果管理层只批一个季度的试点，第一期该抓哪一个最值钱的环节？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "高分答案应把合规风险和效率价值同时讲清楚，尤其要避免把高风险自动化说得太轻松。",
  },
  {
    id: "prd-onboarding-activation",
    title: "新用户激活流程优化需求",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "增长团队说新用户注册后用不起来，想改 onboarding 流程，你帮我先整理需求。",
    userGoal:
      "厘清关键激活动作、分层用户、首日阻塞点和衡量方式。",
    expectedOutcome:
      "一份聚焦激活而不是泛泛引导页改版的需求草案。",
    followUpTurns: [
      "不同用户路径差异很大，个人用户和企业管理员首次任务完全不同。",
      "设计同学希望减少步骤，但运营同学又担心少了引导会更迷茫。",
      "如果只能追一个核心指标，你觉得应该追哪一个？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "好答案会围绕“激活到底是什么”来收敛，而不是把 onboarding 理解成单纯的新手教程。",
  },
  {
    id: "prd-pricing-simulator",
    title: "商家定价模拟器需求定义",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "商家运营想做一个定价模拟器，让品牌方能看到调整价格后的销量和利润变化，帮我整理需求。",
    userGoal:
      "澄清输入参数、输出可信度、适用范围和用户决策场景。",
    expectedOutcome:
      "一个更像运营决策工具、而不是“神奇预测器”的需求说明。",
    followUpTurns: [
      "品牌方最关注的是促销前能不能大致判断利润空间，而不是追求完全精准。",
      "数据团队担心不同品类差异太大，统一模型容易误导。",
      "如果结果只能展示区间，不展示单点预测，产品上怎么解释更好？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "重点是处理预测不确定性的表达，不把需求写成脱离现实的数据魔法。",
  },
  {
    id: "prd-retention-save-offer",
    title: "流失挽回优惠策略需求收敛",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "订阅团队想做一个流失挽回优惠策略，用户取消前给不同折扣，你帮我整理需求。",
    userGoal:
      "澄清谁该看到什么优惠、触发时机、风控限制和实验方式。",
    expectedOutcome:
      "一份能支撑实验设计和规则配置的需求框架。",
    followUpTurns: [
      "不是所有用户都适合给折扣，老用户和免费试用用户的策略应该不同。",
      "法务提醒某些市场对个性化价格展示比较敏感。",
      "如果首期只支持两档优惠，你会怎么定义触发条件？",
    ],
    suggestedTools: ["mockSearch", "calculator"],
    scoringFocus:
      "高分答案会把策略差异、合规约束和实验验证放到同一个需求框架里。",
  },
  {
    id: "prd-after-sales-knowledge-assistant",
    title: "售后知识助手需求澄清",
    category: "product-requirement-clarification",
    difficulty: "medium",
    initialPrompt:
      "客服团队说想要一个售后知识助手，能快速告诉新人怎么处理复杂工单，你先帮我整理下需求。",
    userGoal:
      "澄清是查知识、给建议、自动草拟回复还是工单分流，以及第一阶段应优先做什么。",
    expectedOutcome:
      "一份区分知识检索、操作指引和自动回复边界的需求摘要。",
    followUpTurns: [
      "主管最担心新人照搬错误答案，所以必须能看到依据来源。",
      "一线客服希望结果别太长，最好能直接看到“建议下一步”。",
      "如果第一期不能接全部历史工单，应该先接哪类知识源？",
    ],
    suggestedTools: ["mockSearch"],
    scoringFocus:
      "重点考察是否会先处理可信度和使用方式，而不是上来就定义一个全能客服机器人。",
  },
]);

const dataAnalysisTasks = createTasks([
  {
    id: "analysis-conversion-drop-new-channel",
    title: "新投放渠道带来的转化率下滑诊断",
    category: "data-analysis",
    difficulty: "hard",
    initialPrompt:
      "最近两周注册转付费转化明显下降，市场说是因为新投放渠道进来的人不准，帮我分析一下。",
    userGoal:
      "在渠道、落地页、销售跟进和口径变化之间逐步缩小问题范围。",
    expectedOutcome:
      "一个区分事实、假设和待验证项的分析结论，并说明下一步怎么查。",
    followUpTurns: [
      "按整体看下降了 18%，但老渠道的数据其实变化不大。",
      "新渠道注册量暴增，但激活率比其他渠道低很多。",
      "销售说这批线索质量差，但产品同学怀疑是新落地页表单太长。",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "高分答案需要避免过早站队，而是围绕渠道质量和漏斗阻塞点逐步缩小范围。",
  },
  {
    id: "analysis-enterprise-churn-rise",
    title: "企业客户流失上升的分层分析",
    category: "data-analysis",
    difficulty: "hard",
    initialPrompt:
      "本季度企业客户流失率上升了，老板想知道是产品问题还是销售续约问题，帮我拆一下。",
    userGoal:
      "通过客户分层、合同周期和使用行为线索判断流失主因，不轻易下单一结论。",
    expectedOutcome:
      "一套以分群为核心的诊断思路，并指出最值得验证的两个方向。",
    followUpTurns: [
      "流失主要出现在年付中小客户，大客户续约还算稳定。",
      "这批客户过去三个月的核心功能使用频次明显下降。",
      "销售说最近涨价也有影响，但产品认为流失更多和功能价值不足有关。",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "重点看是否能把续约周期、价格变化和使用衰退组合起来分析，而不是凭感觉选一个原因。",
  },
  {
    id: "analysis-csat-fall-policy-change",
    title: "政策变更后的满意度下降分析",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "客服满意度这个月掉了不少，运营说可能跟退货政策收紧有关，帮我看看怎么分析。",
    userGoal:
      "判断是政策内容、客服执行、话术还是用户预期管理出了问题。",
    expectedOutcome:
      "一个能指导后续抽样复盘和策略调整的分析结论。",
    followUpTurns: [
      "满意度下降主要发生在退款拒绝类工单，不是所有工单都在掉。",
      "同样的政策上线后，资深客服组的评分下降比新客服组轻一些。",
      "如果要快速验证是政策问题还是执行问题，你会先看哪类样本？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "好答案应区分政策设计和执行质量，尤其要利用不同客服组之间的差异信号。",
  },
  {
    id: "analysis-refund-rate-region-spike",
    title: "区域退款率异常上升排查",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "华南地区这个月退款率突然比其他区高很多，运营怀疑是物流问题，也有人说是活动客群问题，你帮我看。",
    userGoal:
      "判断异常到底来自供给履约、活动流量还是某类商品结构变化。",
    expectedOutcome:
      "一个能分辨区域、商品和活动影响的诊断框架。",
    followUpTurns: [
      "异常主要集中在家电品类，服饰品类退款率变化不大。",
      "同期华南确实做了一轮更激进的满减活动。",
      "物流签收时长只变差了一点点，但某几个仓的破损投诉明显增加。",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "高分答案会把区域、品类、活动和仓配拆开看，而不是只抓住单一解释。",
  },
  {
    id: "analysis-supply-delay-variance",
    title: "补货延迟波动的运营诊断",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "采购说最近补货延迟很不稳定，有的周正常有的周爆炸，帮我分析可能是什么原因。",
    userGoal:
      "结合供应商、仓库和需求波动判断最可能的波动源头。",
    expectedOutcome:
      "一个说明需要从哪几个维度继续切分数据的分析建议。",
    followUpTurns: [
      "波动主要发生在两个核心供应商，但并不是每个 SKU 都受影响。",
      "大促前一周延迟最严重，平时还好。",
      "仓库同学怀疑是到货集中导致入库拥堵，而不是供应商发货慢。",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "重点看是否能区分上游供给波动和仓内处理瓶颈，而不是把延迟都归因给供应商。",
  },
  {
    id: "analysis-pricing-test-cannibalization",
    title: "定价实验是否产生蚕食效应",
    category: "data-analysis",
    difficulty: "hard",
    initialPrompt:
      "我们给新客做了一个降价实验，订单量涨了，但老板担心只是把原本愿意原价买的人便宜卖掉了，帮我分析。",
    userGoal:
      "判断增量和蚕食效应，避免只看表面转化率提升。",
    expectedOutcome:
      "一个能说明实验收益是否真实成立的分析思路。",
    followUpTurns: [
      "实验组转化高了 12%，但客单价下降了 9%。",
      "重复购买率暂时还看不出来差异，因为观察窗口只有两周。",
      "如果要判断是否只是把高意向用户低价卖掉，你会补看哪些指标？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "高分答案会主动引入利润和用户质量视角，而不是停留在转化率上涨这个表层指标。",
  },
  {
    id: "analysis-forecast-gap-quarter",
    title: "季度销售预测偏差复盘",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "我们季度销售预测最后偏差很大，实际比预测低了 15%，管理层想知道模型问题还是业务节奏变化，帮我拆解。",
    userGoal:
      "分析预测偏差来源，区分模型设定、输入数据变化和业务执行因素。",
    expectedOutcome:
      "一套能指导下次预测迭代的复盘框架。",
    followUpTurns: [
      "偏差主要出现在月末冲刺阶段，月初和月中还算接近。",
      "销售团队这个季度中途换了激励政策。",
      "如果只能优先修一个环节，你会先修模型输入还是销售执行口径？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "重点是把“预测错了”拆成建模问题和业务行为变化两部分，而不是泛泛说继续优化模型。",
  },
  {
    id: "analysis-pick-error-shift",
    title: "仓库班次拣货错误率异常",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "仓库反馈最近拣货错误率上升，但只在某些班次明显，你帮我分析一下可能的原因。",
    userGoal:
      "判断是人员、流程、设备还是订单结构变化导致的异常。",
    expectedOutcome:
      "一个围绕班次、 SKU 复杂度和作业环境展开的分析思路。",
    followUpTurns: [
      "夜班错误率明显高于白班，但夜班订单量本来就更高。",
      "夜班最近接手了更多组合装订单，拣货路径也更复杂。",
      "仓库主管说新员工培训不够，产品同学则怀疑 PDA 提示设计有问题。",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "好答案会先控制工作量和订单复杂度差异，再比较人、系统和流程因素。",
  },
  {
    id: "analysis-lead-quality-mismatch",
    title: "市场线索量高但成交质量差",
    category: "data-analysis",
    difficulty: "hard",
    initialPrompt:
      "最近市场带来的线索数量很漂亮，但销售说成单质量不行，你帮我分析到底是哪一段出了问题。",
    userGoal:
      "结合投放、表单、MQL 规则和销售跟进判断漏斗失真点。",
    expectedOutcome:
      "一个说明该先修线索定义还是先修获客渠道的分析结论。",
    followUpTurns: [
      "新线索里学生和个体创业者比例变高了，但我们主卖企业方案。",
      "市场说他们按注册意向提交了足够多线索，销售觉得这些人根本不是真需求。",
      "如果要验证是打分规则太松还是渠道定向错了，你会怎么切？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "高分答案会把“数量增长”和“质量下滑”放在同一漏斗里看，而不是互相甩锅。",
  },
  {
    id: "analysis-search-zero-result",
    title: "站内搜索零结果率上升排查",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "站内搜索零结果率最近上升了，大家不确定是埋点、索引还是用户搜索词变了，帮我分析一下。",
    userGoal:
      "定位问题更像技术故障还是需求变化，并给出最有价值的验证顺序。",
    expectedOutcome:
      "一个结合技术链路和用户意图变化的诊断路径。",
    followUpTurns: [
      "英文搜索词和品牌词的零结果率涨得最明显。",
      "刚好上周做过一次搜索索引更新。",
      "如果只能先抽查 50 个查询样本，你会怎么分层抽？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "重点看是否能同时考虑技术变更和用户查询结构变化，而不是只盯一边。",
  },
  {
    id: "analysis-retention-after-feature",
    title: "新功能上线后的留存变化解释",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "一个新功能上线后，7 日留存看起来变好了，但产品经理担心只是活跃用户本来就会回来，帮我分析。",
    userGoal:
      "判断留存提升是否真的由功能带来，而不是用户基线差异造成的错觉。",
    expectedOutcome:
      "一个明确区分相关性和因果线索的分析方案。",
    followUpTurns: [
      "使用新功能的人本来就更高频，所以直接比较整体留存不太公平。",
      "功能入口目前只对一部分新用户开放。",
      "如果没有标准 A/B 实验，你会怎么尽量接近可信结论？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "高分答案应主动处理样本选择偏差，而不是把使用者表现更好直接当作功能有效。",
  },
  {
    id: "analysis-cancelation-peak-after-delivery-promise",
    title: "承诺送达时间调整后的取消率变化",
    category: "data-analysis",
    difficulty: "medium",
    initialPrompt:
      "我们把商品详情页的预计送达时间展示方式改了之后，取消率有波动，运营想知道是好是坏，帮我分析。",
    userGoal:
      "判断用户预期管理变化对下单和取消的综合影响，而不是只看一个指标。",
    expectedOutcome:
      "一套兼看转化和取消的综合分析结论。",
    followUpTurns: [
      "改版后下单转化略降，但部分品类的取消率也下降了。",
      "快消品影响不大，大家电品类影响最明显。",
      "如果需要给运营一个明确建议，是继续放大真实时效还是回到更乐观的展示？",
    ],
    suggestedTools: ["calculator", "mockSearch"],
    scoringFocus:
      "重点在于能否用整体收益视角评估预期管理，而不是只挑对自己有利的单一指标。",
  },
]);

const productRecommendationTasks = createTasks([
  {
    id: "recommend-laptop-hybrid-work",
    title: "兼顾办公与出差的笔记本推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "帮我选一台笔记本，我平时写文档、开很多会、偶尔写代码，还经常出差。",
    userGoal:
      "在重量、续航、性能、预算和系统偏好不断变化时维持清晰的推荐逻辑。",
    expectedOutcome:
      "一套能随着用户补充预算和使用场景而持续收敛的推荐过程。",
    followUpTurns: [
      "预算大概 8000 到 10000 元，不太想买特别重的机型。",
      "我偶尔需要连双屏，还希望键盘别太软。",
      "如果 Windows 和 macOS 你都给方案，最好能说清各自牺牲了什么。",
    ],
    suggestedTools: ["productDb", "mockSearch", "calculator"],
    scoringFocus:
      "高分答案会围绕真实使用优先级做取舍，而不是只用参数表做横向比较。",
  },
  {
    id: "recommend-air-purifier-baby-pets",
    title: "有宝宝和宠物家庭的空气净化器推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我家有一岁宝宝和两只猫，想买空气净化器，帮我挑一下。",
    userGoal:
      "平衡噪音、净化能力、滤芯成本和房间面积，不做空泛推荐。",
    expectedOutcome:
      "一套能根据房间大小、使用时段和预算进一步收敛的推荐建议。",
    followUpTurns: [
      "晚上宝宝睡觉时噪音要低，客厅大概 35 平。",
      "我不想后期滤芯太贵，一年总成本最好心里有数。",
      "如果两台机器差别不大，我更愿意买维护省心的那种。",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "重点看是否会把使用环境和后期维护一起纳入推荐，而不是只看 CADR 数字。",
  },
  {
    id: "recommend-crm-plan-small-team",
    title: "小团队 CRM 套餐选择",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我们 12 个人的销售团队想上 CRM，预算有限，但又不想后面很快就得换系统，怎么选？",
    userGoal:
      "根据团队规模、协作方式和未来扩张计划推荐更合适的产品方案。",
    expectedOutcome:
      "一个体现当前预算与未来可扩展性取舍的推荐过程。",
    followUpTurns: [
      "我们最先要的是线索管理和销售漏斗，不一定马上要复杂自动化。",
      "老板担心便宜方案以后数据迁移麻烦，所以不想只看当前价格。",
      "如果两款方案价格差距不大，你会优先建议更易上手还是功能更全？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "高分答案会像顾问一样处理“先够用还是提前一步到位”的决策，而不是只看报价。",
  },
  {
    id: "recommend-headphones-commute-calls",
    title: "通勤加会议场景耳机推荐",
    category: "product-recommendation",
    difficulty: "easy",
    initialPrompt:
      "帮我推荐一副耳机，我平时地铁通勤、办公室开会都要用。",
    userGoal:
      "在降噪、麦克风、佩戴舒适度和续航之间做清晰权衡。",
    expectedOutcome:
      "一个会随着预算和佩戴习惯调整的耳机推荐方案。",
    followUpTurns: [
      "我耳道比较敏感，不太喜欢戴久了会胀的入耳式。",
      "预算最好别超过 1500 元，但如果差得很明显也可以稍微加一点。",
      "会议通话质量对我很重要，不只是听歌。",
    ],
    suggestedTools: ["productDb", "calculator"],
    scoringFocus:
      "好答案会根据使用时长和通话需求调整推荐，而不是只围绕音质做判断。",
  },
  {
    id: "recommend-running-watch-marathon",
    title: "准备半马的运动手表推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我最近开始认真跑步，准备跑半马，想买块运动手表，帮我选一下。",
    userGoal:
      "在训练功能、续航、日常佩戴和预算之间做取舍。",
    expectedOutcome:
      "一套能随着训练频率和智能功能偏好变化而调整的推荐建议。",
    followUpTurns: [
      "我每周大概跑四次，也会骑车，但不太需要特别重的户外功能。",
      "希望平时上班戴着也别太突兀。",
      "如果更专业的款式贵很多，你会建议一步到位还是先买够用的？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "重点在于判断用户到底是在买训练工具还是买综合智能穿戴，而不是默认越专业越好。",
  },
  {
    id: "recommend-coffee-machine-office",
    title: "小办公室咖啡机选型",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我们 15 人办公室想买一台咖啡机，平时大家都会喝，但没人想天天清理，怎么选比较好？",
    userGoal:
      "兼顾出杯效率、维护成本、口味稳定性和采购预算。",
    expectedOutcome:
      "一套围绕办公室日常运营而不是个人发烧需求的推荐逻辑。",
    followUpTurns: [
      "大家早上会集中用，所以出杯速度不能太慢。",
      "行政同事最担心清洁麻烦和后期故障率高。",
      "如果全自动和胶囊机都能满足需求，你会怎么比较长期成本？",
    ],
    suggestedTools: ["productDb", "calculator"],
    scoringFocus:
      "高分答案应把多人共用和维护负担当作核心变量，而不是只比较咖啡口感。",
  },
  {
    id: "recommend-monitor-design-code",
    title: "设计与代码双用途显示器推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我既做设计也写代码，想买一台显示器，最好一台就能兼顾，不知道怎么选。",
    userGoal:
      "在色准、尺寸、分辨率、接口和预算之间找到平衡。",
    expectedOutcome:
      "一套会随着桌面空间和工作比例变化而调整的显示器推荐建议。",
    followUpTurns: [
      "我的桌子不算大，太宽的屏可能放不下。",
      "Mac 和 Windows 笔记本都会接，接口和缩放体验要考虑。",
      "如果 4K 和高刷不能兼得，你会优先建议哪边？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "重点看是否能根据真实工作占比做取舍，而不是把所有参数都往高配堆。",
  },
  {
    id: "recommend-stroller-city-travel",
    title: "城市通勤兼旅行的婴儿车推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "想买一台婴儿车，平时城市里推，偶尔也会带着坐高铁出去玩，帮我推荐一下。",
    userGoal:
      "平衡收纳便利、避震、重量和宝宝年龄阶段需求。",
    expectedOutcome:
      "一个能随着楼梯、电梯和出行频率变化而继续收敛的推荐过程。",
    followUpTurns: [
      "我们家住没有电梯的老小区，太重真的不行。",
      "宝宝现在 8 个月，但希望至少能再用两年。",
      "如果轻便和避震一定要二选一，你会怎么判断？",
    ],
    suggestedTools: ["productDb", "calculator"],
    scoringFocus:
      "关键在于把搬运场景和使用周期结合起来，而不是泛泛说“看需求选择轻便款”。",
  },
  {
    id: "recommend-mattress-back-pain",
    title: "腰背不适用户的床垫选择",
    category: "product-recommendation",
    difficulty: "easy",
    initialPrompt:
      "我最近总觉得腰背不舒服，想换床垫，但完全不懂该怎么选，帮我理一下。",
    userGoal:
      "根据睡姿、软硬偏好、伴侣差异和预算给出更稳妥的选择建议。",
    expectedOutcome:
      "一套能帮助用户缩小范围并理解取舍的床垫推荐方案。",
    followUpTurns: [
      "我平时侧睡比较多，另一半仰睡，而且更喜欢偏硬一点。",
      "预算大概一万以内，希望不要买完半年就塌。",
      "如果你觉得一定要先去线下试躺，应该优先关注什么感受？",
    ],
    suggestedTools: ["productDb", "mockSearch"],
    scoringFocus:
      "好答案要处理双人差异和体感不确定性，而不是假装能在线上直接给唯一答案。",
  },
  {
    id: "recommend-projector-classroom-portable",
    title: "便携教学投影仪选型",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "学校老师想买一台便携投影，平时要在不同教室之间带着走，帮我推荐一下。",
    userGoal:
      "兼顾亮度、便携性、接线便利和预算，不被营销参数带偏。",
    expectedOutcome:
      "一套适合教学场景的投影推荐逻辑。",
    followUpTurns: [
      "不是每个教室都能完全拉窗帘，所以亮度不能太低。",
      "老师经常用自己的笔记本和 U 盘切换播放。",
      "如果便携款亮度明显不够，你会建议加预算还是调整使用方式？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "高分答案会用真实教室环境约束推荐，而不是只拿家庭娱乐场景的标准来判断。",
  },
  {
    id: "recommend-robot-vacuum-pet-hair",
    title: "多层住宅宠物家庭扫地机器人推荐",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "我家两层楼，还有一只掉毛很多的狗，想买扫地机器人，帮我选一下。",
    userGoal:
      "平衡吸力、避障、拖地能力、维护成本和多层地图需求。",
    expectedOutcome:
      "一套适合宠物家庭的扫拖机器人推荐思路。",
    followUpTurns: [
      "家里地上经常会有宠物玩具，避障做不好会很麻烦。",
      "我更在意维护省心，不想天天拆洗各种零件。",
      "如果带自动集尘的版本贵很多，这笔钱值不值？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "重点看是否把宠物毛发、障碍物和维护负担同时纳入决策，而不是单看吸力。",
  },
  {
    id: "recommend-office-chair-long-sit",
    title: "长期久坐办公椅推荐",
    category: "product-recommendation",
    difficulty: "easy",
    initialPrompt:
      "我每天坐着办公时间很长，最近肩颈和腰都不太舒服，想换一把办公椅，你帮我选一下。",
    userGoal:
      "在支撑性、可调节性、空间占用和预算之间做更贴近真实使用的推荐。",
    expectedOutcome:
      "一个能根据身高体型和坐姿习惯逐步收敛的办公椅建议。",
    followUpTurns: [
      "我身高 160，不想买那种特别大、调节很复杂的椅子。",
      "预算最好控制在 3000 元以内，但不想买纯营销款。",
      "如果同价位里一个更舒服、一个更耐用，你会怎么建议？",
    ],
    suggestedTools: ["productDb", "calculator", "mockSearch"],
    scoringFocus:
      "好答案会围绕体型、调节难度和长时间使用体验来判断，而不是只看品牌名气。",
  },
]);

export const benchmarkTaskLibrary: BenchmarkTaskDefinition[] = [
  ...travelPlanningTasks,
  ...customerSupportTasks,
  ...prdClarificationTasks,
  ...dataAnalysisTasks,
  ...productRecommendationTasks,
];
