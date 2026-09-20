window.HANDBOOK = {
  meta: {
    title: "新西兰访客签证办理清单",
    subtitle: "申请人：2人 · 行程：2026年底，约10–15天 · 签证类型：Visitor Visa",
    lastReviewed: "2026-09-13",
    asOf: "2026-09-19",
  },

  timeline: [
    {
      id: "prep",
      when: "应于 2026年9月中旬前完成",
      title: "启动准备",
      start: null,
      end: "2026-09-15",
      items: [
        { id: "tl-dates", text: "确定大致出行窗口（建议避开 12月20日至次年1月10日）" },
        {
          id: "tl-path",
          text: "确定申请路径：同行且同日入境、行程一致者优先 Group Visitor Visa；否则分别申请",
        },
        {
          id: "tl-passport",
          text: "核查两本护照有效期：自预计离开新西兰之日起至少再有效3个月（实务建议预留6个月）",
        },
        {
          id: "tl-gather",
          text: "归集原件：护照、身份证、户口簿、银行账户资料及在职相关材料",
        },
      ],
    },
    {
      id: "week1",
      when: "2026-09-20 ~ 09-21",
      title: "人像采集与资金流水",
      start: "2026-09-20",
      end: "2026-09-21",
      items: [
        {
          id: "tl-photo",
          text: "拍摄电子签证照片（两人）：竖版3:4，JPG，512KB–3.14MB；不得美颜、滤镜或AI修图",
          link: {
            label: "移民局拍照要求（中文）",
            href: "https://www.immigration.govt.nz/assets/inz/documents/apply-for-a-visa/Taking-acceptable-visa-photos-in-Simplified-Chinese.pdf",
          },
        },
        { id: "tl-passport-scan", text: "扫描护照资料页（含MRZ），彩色、完整、无裁切水印" },
        {
          id: "tl-bank",
          text: "向银行申请近连续6个月流水；优先英文或中英双语版本",
        },
        {
          id: "tl-id-scan",
          text: "扫描身份证正反面，以及户口簿封面、户主页与本人页",
        },
      ],
    },
    {
      id: "week2",
      when: "2026-09-22 ~ 09-26",
      title: "翻译、在职与行程材料",
      start: "2026-09-22",
      end: "2026-09-26",
      items: [
        {
          id: "tl-hr",
          text: "请用人单位出具在职说明（含放假/准假安排）",
          note: "用途：证明你在国内有稳定工作，出行期间离岗合理，结束后会返岗，用来支撑「短期旅游、会按时回国」。适用范围：有正式工作的申请人。公司集体放假或个人请假均可；用公司自有模板即可，一般需写明职位、在职情况、放假/准假起止日、返岗日及公司联系方式。仅有「在职证明」、不写行程相关日期通常不够。学生、待业、自由职业等不适用此项，改用学业、生意或其他回国约束材料。",
        },
        {
          id: "tl-translate",
          text: "将身份证、户口簿及中文流水（如无英文版）送交第三方翻译，并附翻译人员声明",
          templates: ["06", "07"],
        },
        {
          id: "tl-1027",
          text: "每名申请人填写并签署 INZ 1027，扫描为 PDF",
          link: {
            label: "INZ 1027",
            href: "https://www.immigration.govt.nz/assets/inz/documents/forms-and-guides/inz1027.pdf",
          },
        },
        {
          id: "tl-cover",
          text: "撰写个人旅行说明信（两人事实与日期须一致）",
          templates: ["01"],
        },
        {
          id: "tl-itin",
          text: "撰写英文逐日行程表（两人共用同一版本）",
          templates: ["05"],
        },
        {
          id: "tl-group-letter",
          text: "若选择 Group 申请：另行准备共同说明信",
          templates: ["02"],
        },
        {
          id: "tl-funding",
          text: "若一方承担另一方费用：填写费用承担说明并双方签署",
          templates: ["04"],
        },
      ],
    },
    {
      id: "submit",
      when: "2026-09-28 ~ 10-05",
      title: "核对并递交",
      start: "2026-09-28",
      end: "2026-10-05",
      items: [
        {
          id: "tl-upload",
          text: "通过在线系统上传材料（PDF ≤10MB、未加密）",
          link: {
            label: "Enhanced Immigration Online",
            href: "https://www.immigration.govt.nz/process-to-apply/applying-for-a-visa/applying-online/enhanced-immigration-online/",
          },
        },
        {
          id: "tl-consistency",
          text: "核对姓名、出生日期、护照号及行程、航班、住宿、在职信所载日期全文一致",
        },
        { id: "tl-pay", text: "完成缴费，保存回执与申请编号" },
      ],
    },
    {
      id: "wait",
      when: "递交后至获签前",
      title: "等待审理",
      start: "2026-10-06",
      end: null,
      open: true,
      items: [
        { id: "tl-flexible", text: "机票与酒店仅使用可免费取消或可退改方案，勿购买不可退订单" },
      ],
    },
    {
      id: "approved",
      when: "获签后",
      title: "行程预订",
      start: null,
      end: null,
      open: true,
      items: [
        { id: "tl-flights", text: "预订国际及境内联程机票" },
        { id: "tl-car", text: "预订租车，并确认驾照英文翻译要求" },
        {
          id: "tl-hotels",
          text: "预订住宿（建议优先：蒂卡波、库克山/Twizel、皇后镇、Te Anau）",
        },
        { id: "tl-milford", text: "预订米尔福德峡湾游船及旅行保险" },
      ],
    },
    {
      id: "t14",
      when: "启程前 1–2 周",
      title: "行前核对",
      start: null,
      end: null,
      open: true,
      items: [
        { id: "tl-offline", text: "将 eVisa、保险单、订单及行程下载至离线可查" },
        { id: "tl-licence", text: "准备中国驾照原件及 NZTA 认可来源的英文翻译件" },
        { id: "tl-biosecurity", text: "清理徒步鞋等户外用品；药品保留原包装及处方或医生说明" },
      ],
    },
    {
      id: "t1",
      when: "启程前 24 小时内",
      title: "入境申报",
      start: null,
      end: null,
      open: true,
      items: [
        {
          id: "tl-nztd",
          text: "两名申请人各自提交 New Zealand Traveller Declaration（NZTD）",
          link: { label: "NZTD 官网", href: "https://www.travellerdeclaration.govt.nz/" },
        },
        {
          id: "tl-transit",
          text: "如经澳大利亚转机：确认是否需要持有 Transit Visa（Subclass 771）",
        },
      ],
    },
  ],

  // 外勤合并建议（非主排期，供减少往返）
  batches: [
    {
      id: "photo",
      title: "照相馆 · 一次办结",
      note: "两人同行；仅需电子文件，无需冲印。",
      carry: ["两名申请人本人", "移民局拍照要求（手机打开即可）"],
      tasks: [
        "申请人 A、B 各拍摄一张符合规格的电子签证照",
        "当场核验文件大小与格式，并将原图发送至手机或邮箱",
      ],
      link: {
        label: "移民局拍照要求（中文）",
        href: "https://www.immigration.govt.nz/assets/inz/documents/apply-for-a-visa/Taking-acceptable-visa-photos-in-Simplified-Chinese.pdf",
      },
    },
    {
      id: "bank",
      title: "银行网点 · 一次办结",
      note: "如可通过网银或手机银行取得合格流水，可省略本项外勤。优先索取英文或中英双语版本。",
      carry: ["身份证", "银行卡或存折", "护照（视银行要求）"],
      tasks: [
        "分别申请两名申请人近连续6个月账户流水",
        "尽量取得 PDF；若仅有纸质件，并入下一次扫描复印外勤",
      ],
    },
    {
      id: "scan",
      title: "扫描复印 · 一次办结",
      note: "原件一次性带齐。输出要求：彩色 PDF、单文件不超过10MB、未加密、页面方向正确。",
      carry: [
        "两本护照",
        "两张身份证",
        "户口簿",
        "纸质银行流水（如有）",
        "收入证明纸质件（如有）",
        "已开具的在职说明（如有）",
        "已签署的 INZ 1027（如有）",
      ],
      tasks: [
        "护照资料页 ×2（含 MRZ）",
        "身份证正反面 ×2",
        "户口簿封面、户主页及两名申请人本人页",
        "纸质流水、收入证明、在职说明、INZ 1027（按实际持有扫描）",
        "将全部电子文件拷贝至手机或存储介质",
      ],
    },
    {
      id: "translate",
      title: "翻译委托 · 一次送翻",
      note: "中文材料宜集中交付，避免分批往返。",
      carry: ["身份证扫描件", "户口簿扫描件", "中文流水或收入证明（如适用）"],
      tasks: [
        "完整英文翻译上述文件",
        "附具翻译人员声明",
      ],
      templates: ["06", "07"],
    },
  ],

  templateIndex: {
    "01": { label: "01 个人旅行说明信", file: "01-个人旅行说明信模板.pdf" },
    "02": { label: "02 Group共同说明信", file: "02-Group共同说明信模板.pdf" },
    "04": { label: "04 费用承担说明", file: "04-费用承担说明模板.pdf" },
    "05": { label: "05 旅行行程表", file: "05-旅行行程表模板.pdf" },
    "06": { label: "06 翻译人员声明", file: "06-翻译人员声明模板.pdf" },
    "07": { label: "07 常用材料英文翻译", file: "07-常用材料英文翻译模板.pdf" },
  },

  docs: [
    { id: "doc-passport", title: "护照资料页", detail: "彩色完整，含 MRZ；PDF < 10MB", upload: "Passport / Identity", channel: "扫描复印" },
    { id: "doc-photo", title: "电子签证照片", detail: "竖版 3:4 JPG；512KB–3.14MB", upload: "Photo", channel: "照相馆" },
    { id: "doc-id", title: "身份证", detail: "正反面扫描 + 英文翻译", upload: "Identity / Translation", channel: "扫描复印 → 翻译" },
    { id: "doc-hukou", title: "户口簿", detail: "封面、户主页、本人页 + 翻译", upload: "Identity / Translation", channel: "扫描复印 → 翻译" },
    { id: "doc-bank", title: "银行流水", detail: "近连续6个月；优先英文或双语", upload: "Funds", channel: "银行" },
    { id: "doc-income", title: "收入证明", detail: "与流水入账相符", upload: "Funds / Employment", channel: "用人单位 / 税务" },
    {
      id: "doc-leave",
      title: "在职说明（含放假/准假安排）",
      detail:
        "用途：证明在职，并说明出行期间离岗合理、结束后返岗，以支撑会按时回国。适用范围：有正式工作的申请人；公司集体放假或个人请假均可，用公司自有格式。学生/待业/自由职业不适用。",
      upload: "Employment",
      channel: "用人单位",
    },
    { id: "doc-1027", title: "INZ 1027", detail: "年满17岁每人一份，签署后扫描", upload: "Supplementary form", channel: "自行填写 → 扫描" },
    { id: "doc-cover", title: "个人旅行说明信", detail: "英文，1–2页", upload: "Cover letter", channel: "自行撰写", templates: ["01"] },
    { id: "doc-itin", title: "旅行行程表", detail: "两人共用同一版本", upload: "Travel plans", channel: "自行撰写", templates: ["05"] },
    { id: "doc-flight", title: "航班安排", detail: "获签前使用可退改订单即可", upload: "Onward travel", channel: "在线预订" },
    { id: "doc-hotel", title: "住宿安排", detail: "须与行程一致", upload: "Accommodation", channel: "在线预订" },
    { id: "doc-funding", title: "费用承担说明", detail: "仅一方代付时提交", upload: "Funds", channel: "自行撰写", templates: ["04"], optional: true },
  ],

  paths: [
    {
      id: "group-two",
      recommended: true,
      title: "Group Visitor Visa（建议）",
      visaType: "Group Visitor Visa",
      fee: "两人合计 NZD 542（约 RMB 2,168）",
      perPerson: "人均 NZD 271",
      requires: "同日抵达，行程一致",
      steps: [
        "由一人创建 group 并担任 administrator",
        "上传共同说明信与行程表",
        "在组内分别建立两份个人申请并各自上传材料",
        "按系统要求签署 INZ 1224",
        "完成团体声明后由管理员统一缴费",
      ],
      templates: ["02", "05"],
      link: "https://www.immigration.govt.nz/visas/group-visitor-visa/",
    },
    {
      id: "individual",
      recommended: false,
      title: "分别申请 Visitor Visa",
      visaType: "Visitor Visa",
      fee: "两人合计 NZD 882（约 RMB 3,528）",
      perPerson: "人均 NZD 441",
      requires: "行程、航班、住宿信息保持一致",
      steps: [
        "各自创建普通 Visitor Visa 申请",
        "各自上传个人材料",
        "说明信中列明同行人姓名、出生日期、护照号及申请编号",
        "各自缴费并保存回执",
      ],
      link: "https://www.immigration.govt.nz/visas/visitor-visa/",
    },
  ],

  funds: [
    "未预付住宿：每人每月至少 NZD 1,000；两人每月至少 NZD 2,000",
    "已预付住宿：每人每月至少 NZD 400；两人每月至少 NZD 800",
    "另须证明持有返程机票，或具备购买返程机票的充足资金",
  ],

  preflight: [
    { id: "pf-names", text: "姓名、出生日期、护照号在全部文件中保持一致" },
    { id: "pf-dates", text: "行程、航班、住宿与在职信所载日期保持一致" },
    { id: "pf-trans", text: "中文材料均附完整英文翻译" },
    { id: "pf-pdf", text: "每个 PDF 小于 10MB，可正常打开且未加密" },
    { id: "pf-bank", text: "银行流水连续6个月，无不具合理解释的大额临时入账" },
    { id: "pf-group", text: "Group 申请：确认同日抵达且行程一致" },
    { id: "pf-refund", text: "获签前未购买不可退改的机票或酒店" },
    { id: "pf-save", text: "已保存缴费回执、申请编号及 eVisa" },
  ],

  links: [
    { label: "Visitor Visa", href: "https://www.immigration.govt.nz/visas/visitor-visa/" },
    { label: "Group Visitor Visa", href: "https://www.immigration.govt.nz/visas/group-visitor-visa/" },
    {
      label: "中国公民访客签证申请指南",
      href: "https://www.immigration.govt.nz/process-to-apply/applying-for-a-visa/providing-evidence-and-documents-to-support-your-visa-application/visitor-visa-application-guide-for-citizens-of-china/",
    },
    {
      label: "签证照片要求",
      href: "https://www.immigration.govt.nz/process-to-apply/applying-for-a-visa/applying-online/uploading-documents-and-photos/visa-and-nzeta-photos/",
    },
    {
      label: "上传文件格式要求",
      href: "https://www.immigration.govt.nz/process-to-apply/applying-for-a-visa/applying-online/uploading-documents-and-photos/file-formats-for-uploading-documents-and-photos/",
    },
    { label: "NZTD", href: "https://www.travellerdeclaration.govt.nz/" },
  ],
};
