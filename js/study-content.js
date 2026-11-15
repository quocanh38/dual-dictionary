// Offline practice content packs. Keep every passage, prompt and asset original
// or properly licensed; this starter pack contains no official exam material.
import {
  IELTS_BAND_7_PRACTICE_EXERCISES,
  IELTS_BAND_7_SPEAKING_PROMPTS,
  IELTS_BAND_7_WRITING_PROMPTS,
  IELTS_DIAGNOSTIC_ADDITIONS,
  IELTS_DIAGNOSTIC_EXISTING_ITEMS,
  IELTS_DIAGNOSTIC_FORM,
  IELTS_DIAGNOSTIC_PASSAGES,
  IELTS_DIAGNOSTIC_SCRIPTS,
} from "./ielts-diagnostic-content.js";
import {
  IELTS_META_PRACTICE_EXERCISES,
  IELTS_META_SPEAKING_PROMPTS,
  IELTS_META_WRITING_PROMPTS,
} from "./ielts-meta-practice.js";
export { IELTS_DIAGNOSTIC_FORM };
export const STUDY_CONTENT_SCHEMA_VERSION = 1;

export const IELTS_PATHWAY_STAGES = [
  {
    id: "band-5",
    label: "Chặng nền · quanh 5.0",
    shortLabel: "Nền 5.0",
    description: "Làm rõ ý chính, trả lời đủ yêu cầu quen thuộc và giảm lỗi lặp lại.",
  },
  {
    id: "band-6",
    label: "Chặng 1 · 5.0 → 6.0",
    shortLabel: "5.0 → 6.0",
    description: "Xử lý paraphrase và dạng bài phổ biến ổn định hơn; nối câu trả lời thành mạch rõ.",
  },
  {
    id: "band-6-5",
    label: "Chặng 2 · 6.0 → 6.5",
    shortLabel: "6.0 → 6.5",
    description: "Luyện ý học thuật dày hơn, phối hợp dạng bài và diễn đạt chính xác dưới áp lực thời gian.",
  },
  {
    id: "band-7",
    label: "Chặng 3 · 6.5 → 7.0",
    shortLabel: "6.5 → 7.0",
    description: "Tinh chỉnh lập luận, suy luận từ bằng chứng và giữ độ chính xác khi xử lý nội dung học thuật phức tạp.",
  },
];

// Teaching guidance is based on the app author's four method articles. The
// pathway stage classifies the practice target; step-by-step guidance is the method
// used to scaffold how learners approach the task.
export const IELTS_LINEAR_GUIDANCE = {
  Listening: {
    title: "Nghe theo thứ tự ý",
    steps: "Neo bối cảnh ở câu đầu → dự đoán loại thông tin cần nghe → bám ý và chờ người nói sửa ý → cuối đoạn mới tóm tắt; chỉ mở transcript sau lượt nghe đầu.",
    blog: "/vi/blog/phuong-phap/listening-khong-kip-dich/",
  },
  Reading: {
    title: "Nắm trục câu trước, chi tiết gắn quanh",
    steps: "Đọc theo thứ tự câu xuất hiện → tìm chủ ngữ và động từ chính → gắn điều kiện/chi tiết vào trục → chọn bằng chứng trong bài trước khi chốt đáp án.",
    blog: "/vi/blog/phuong-phap/reading-hieu-mot-lan/",
  },
  Writing: {
    title: "Dựng câu từ khung chủ ngữ + động từ",
    steps: "Chốt một ý → viết trục chủ ngữ + động từ → thêm lý do/chi tiết → nối các ý bằng quan hệ rõ như because, while, as a result.",
    blog: "/vi/blog/phuong-phap/writing-khung-cau/",
  },
  Speaking: {
    title: "Phản xạ theo cụm, trả lời trước",
    steps: "Nói bằng cụm đã luyện → trả lời trực tiếp → thêm lý do và ví dụ; Part 2 ghi từ khóa theo trình tự, Part 3 phát triển quan điểm có chừng mực.",
    blog: "/vi/blog/phuong-phap/speaking-phan-xa-cum/",
  },
};

export const TOEIC_FOCUS_SETS = [
  {
    "id": "toeic-part3-delivery",
    "title": "Giao thiết bị",
    "questionIds": [
      "toeic-l7",
      "toeic-delivery-team",
      "toeic-delivery-reception"
    ]
  },
  {
    "id": "toeic-part3-training-room",
    "title": "Đổi phòng đào tạo",
    "questionIds": [
      "toeic-training-room-1",
      "toeic-training-room-2",
      "toeic-training-room-3"
    ]
  },
  {
    "id": "toeic-part3-invoice-correction",
    "title": "Sửa hóa đơn",
    "questionIds": [
      "toeic-invoice-correction-1",
      "toeic-invoice-correction-2",
      "toeic-invoice-correction-3"
    ]
  },
  { id: "toeic-focus-part4", title: "Đổi lối vào cho khách", part: 4, skill: "Listening", questionIds: ["toeic-l4", "toeic-l4-extra-1", "toeic-l4-extra-2"] },
  { id: "toeic-part4-staff", title: "Thông báo cho nhân viên làm muộn", part: 4, skill: "Listening", questionIds: ["toeic-l8", "toeic-l8-extra-1", "toeic-l8-extra-2"] },
  { id: "toeic-focus-part6", title: "Part 6 · Điền vào văn bản", part: 6, skill: "Reading", questionIds: ["toeic-r4-extra-1", "toeic-r4", "toeic-r4-extra-2", "toeic-r4-extra-3"] },
  {"id": "toeic-part6-returns", "title": "Thông báo quy trình đổi trả", "part": 6, "skill": "Reading", "questionIds": ["toeic-part6-returns-1", "toeic-part6-returns-2", "toeic-part6-returns-3", "toeic-part6-returns-4"]},
  { id: "toeic-focus-part7", title: "Part 7 · Đọc hiểu", part: 7, skill: "Reading", questionIds: ["toeic-r1", "toeic-r1-extra-1", "toeic-r1-extra-2", "toeic-r1-extra-3", "toeic-r1-extra-4"] },
  {"id": "toeic-part7-delayed-order", "title": "Đơn hàng và lịch giao mới", "part": 7, "skill": "Reading", "questionIds": ["toeic-part7-delayed-order-1", "toeic-part7-delayed-order-2", "toeic-part7-delayed-order-3", "toeic-part7-delayed-order-4", "toeic-part7-delayed-order-5"], "timed": true},
  {"id": "toeic-part7-training-update", "title": "Lịch đào tạo và bàn giao", "part": 7, "skill": "Reading", "questionIds": ["toeic-part7-training-update-1", "toeic-part7-training-update-2", "toeic-part7-training-update-3", "toeic-part7-training-update-4", "toeic-part7-training-update-5"]},
];

export const STUDY_CONTENT_PACKS = [
  {
    id: "dual-dictionary-authored-starter",
    schemaVersion: STUDY_CONTENT_SCHEMA_VERSION,
    version: "2.9.0",
    title: "Original IELTS Academic & TOEIC L&R starter pack",
    author: "Dual Dictionary",
    license: "Original app content; not affiliated with IELTS or ETS",
    offline: true,
    exams: [
      { id: "ielts-academic", title: "IELTS Academic", skills: ["Listening", "Reading", "Writing", "Speaking"] },
      { id: "toeic-lr", title: "TOEIC Listening & Reading", skills: ["Listening", "Reading"] },
    ],
    exercises: [
      {
        id: "ia-r1", exam: "IELTS Academic", skill: "Reading", part: "Reading · Passage 1", type: "choice", title: "Urban gardens", pathwayStage: "band-5", focus: "Find the main contrast and connect it to the author’s point.",
        passage: "A community garden can do more than provide fresh vegetables. In several cities, local councils have converted unused plots into shared growing spaces. Residents say that the gardens help neighbours meet, while researchers have observed that regular contact with nature can improve reported wellbeing. The projects are not a substitute for public parks: their small size and shared responsibilities make them better suited to close community participation.",
        prompt: "What is the main distinction between community gardens and public parks in the passage?",
        options: ["Gardens are designed for close participation in a shared project.", "Gardens always produce more food than parks.", "Parks are owned by local residents.", "Researchers found that gardens replace the need for nature."], answer: 0,
        explanation: "The final sentence says the gardens’ small size and shared responsibilities suit close community participation; the passage does not claim they replace parks.",
      },
      {
        id: "ia-r2", exam: "IELTS Academic", skill: "Reading", part: "Reading · Passage 1", type: "choice", title: "Measuring city heat", pathwayStage: "band-5", focus: "Follow the claim, counterpoint and reason for combining measurements.",
        passage: "Tree cover is often proposed as a way to reduce urban heat. However, the effect varies with species, street layout and maintenance. A dense canopy may cool a pedestrian area during the day, yet poorly planned planting can block ventilation in a narrow street. For this reason, some planners combine shade maps with wind measurements before selecting locations.",
        prompt: "Why do some planners use both shade maps and wind measurements?", options: ["To identify where trees can cool streets without restricting airflow.", "To prove that all tree species have the same effect.", "To reduce the cost of measuring temperature.", "To replace maintenance plans."], answer: 0,
        explanation: "The passage contrasts cooling from shade with blocked ventilation and says both kinds of measurements inform location choices.",
      },
      {
        id: "ia-r3", exam: "IELTS Academic", skill: "Reading", part: "Reading · True/False/Not Given", type: "choice", title: "Repair cafés", pathwayStage: "band-5", focus: "Check whether the passage guarantees an outcome or only says it is sometimes possible.",
        passage: "Repair cafés invite residents to bring broken household objects to a community venue. Volunteers with practical skills help visitors diagnose problems and, when possible, make repairs together. Organisers say the events are intended to share knowledge as well as extend the life of useful goods. Some venues publish a list of common repairs, although the range depends on which volunteers attend.",
        prompt: "The organisers guarantee that every item brought to an event will be repaired.", options: ["True", "False", "Not Given"], answer: 1,
        explanation: "The passage says repairs happen when possible, so a guarantee is contradicted.",
      },
      {
        id: "ia-r4", exam: "IELTS Academic", skill: "Reading", part: "Reading · Sentence completion", type: "short-answer", title: "Research gardens", pathwayStage: "band-5", focus: "Locate the study condition and retain the exact answer phrase.",
        passage: "In a three-year study, researchers compared rooftop plots with nearby unused roofs. The garden plots retained more rainwater after moderate storms. During severe downpours, however, drainage systems still carried most excess water away. The researchers therefore describe rooftop gardens as one element of a wider flood-management plan rather than a complete solution.",
        prompt: "After which kind of weather did the gardens retain more rainwater? (Use one or two words.)", acceptedAnswers: ["moderate storms", "moderate storm"],
        explanation: "The first two sentences explicitly refer to moderate storms.",
      },
      {
        id: "ia-l1", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 2", type: "choice", title: "Campus notice", pathwayStage: "band-5", focus: "Predict a place and wait for the speaker’s final correction.",
        transcript: "Hello everyone. The ecology field visit has moved from Thursday to Friday because the minibus is being repaired. Please meet outside the science building at 8:15, not at the main gate. Bring a packed lunch; the café near the reserve is closed this month.",
        prompt: "Where should students meet on Tuesday?", options: ["At the main gate", "Outside the science building", "At the reserve café", "In the minibus garage"], answer: 1,
        explanation: "The speaker says to meet outside the science building at 8:15.",
      },
      {
        id: "ia-l2", exam: "IELTS Academic", skill: "Listening", part: "Listening · Form completion", type: "gap-fill", title: "Library tour booking", pathwayStage: "band-5", focus: "Predict the information type, then capture names and dates from speech chunks.",
        transcript: "You can reserve a place on the archive tour by emailing the library team. Please give your name, Maya Chen, and your student number, 61482. The tour begins at half past two on Wednesday. Meet at the west entrance, where a guide will check your booking.",
        prompt: "Complete the booking notes. (Use the transcript control only after listening.)", gaps: [{ id: "name", label: "Name", acceptedAnswers: ["Maya Chen"] }, { id: "day", label: "Tour day", acceptedAnswers: ["Wednesday"] }],
        explanation: "The speaker gives the name Maya Chen and says the tour is on Wednesday.",
      },
      {
        id: "ia-l3", exam: "IELTS Academic", skill: "Listening", part: "Listening · Matching", type: "matching", title: "Study support sessions", pathwayStage: "band-5", focus: "Link each session to the purpose stated in the same idea unit.",
        transcript: "The writing clinic on Monday focuses on planning an argument. On Tuesday, the data workshop helps students present charts. Thursday's language exchange is an informal speaking session. Friday is reserved for a quiet independent study group.",
        prompt: "Match each session to its focus.", pairs: [{ id: "Monday", label: "Monday clinic", answer: "Argument planning" }, { id: "Tuesday", label: "Tuesday workshop", answer: "Presenting charts" }, { id: "Thursday", label: "Thursday exchange", answer: "Informal speaking" }],
        explanation: "Each focus is stated in the corresponding sentence of the announcement.",
      },
      {
        id: "toeic-l1", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 3 · Conversations", type: "choice", title: "Office voicemail",
        transcript: "Hi Daniel, this is Priya from facilities. The meeting room on the third floor will be unavailable this afternoon while the projector is replaced. I have reserved room 204 for your team from two until four. Please collect the new access card from reception before the meeting.",
        prompt: "What should Daniel do before the meeting?", options: ["Repair the projector", "Move the meeting to tomorrow", "Pick up an access card", "Call the facilities manager"], answer: 2,
        evidence: "Please collect the new access card from reception before the meeting.",
        explanationVi: "Daniel cần lấy thẻ ra vào ở quầy lễ tân. Việc thay máy chiếu giải thích vì sao phòng họp đổi, còn cuộc họp vẫn diễn ra trong ngày.",
        distractorsVi: ["Máy chiếu đang được thay. Priya không yêu cầu Daniel sửa máy.", "Phòng họp đổi sang phòng 204 trong chiều nay. Cuộc họp không dời sang ngày mai.", "", "Lời nhắn không yêu cầu Daniel gọi cho quản lý cơ sở vật chất."],
        explanation: "Priya asks Daniel to collect the new access card from reception before the meeting.",
      },
      {
        id: "toeic-l2", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 1 · Photographs", type: "audio-choice", title: "Office desk",
        image: "./assets/study/toeic-office-desk.svg", imageAlt: "An original illustration of a desk with a laptop, papers and a chair.",
        prompt: "Listen to each statement. Which one best describes the illustration?", options: ["Statement A", "Statement B", "Statement C", "Statement D"],
        audioChoices: ["./assets/study/audio/toeic-part1-a.wav", "./assets/study/audio/toeic-part1-b.wav", "./assets/study/audio/toeic-part1-c.wav", "./assets/study/audio/toeic-part1-d.wav"], answer: 1,
        explanation: "Statement B says that a laptop is open beside some documents, which matches the illustration. The other statements describe actions that are not shown.",
      },
      {
        id: "toeic-l3", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 2 · Question–Response", type: "choice", title: "Delivery time",
        transcript: "Woman: When is the replacement monitor expected to arrive? Man: The courier said before noon tomorrow.",
        prompt: "When will the monitor probably arrive?", options: ["This afternoon", "Before noon tomorrow", "At the end of the month", "After the office closes"], answer: 1,
        explanation: "The response says the courier expects it before noon tomorrow.",
      },
      {
        id: "toeic-l4", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 4 · Talks", type: "choice", title: "Visitor announcement",
        transcript: "Attention visitors: the west entrance is temporarily closed while new signs are installed. Please use the main entrance on King Street. The information desk can provide updated maps, and the west entrance is expected to reopen at 4 p.m.",
        prompt: "What are visitors asked to do?", options: ["Use the main entrance", "Wait until tomorrow", "Collect signs from the desk", "Enter from the west street"], answer: 0,
        explanation: "The announcement directs visitors to the main entrance on King Street.",
        audio: "./assets/study/audio/toeic-focus-l4.wav",
        explanationVi: "Khách được yêu cầu dùng lối vào chính trên đường King vì lối phía tây đang đóng.",
      },
      {
        "id": "toeic-l4-extra-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 4 · Talks",
        "title": "Visitor announcement",
        "audio": "./assets/study/audio/toeic-focus-l4.wav",
        "transcript": "Attention visitors: the west entrance is temporarily closed while new signs are installed. Please use the main entrance on King Street. The information desk can provide updated maps, and the west entrance is expected to reopen at 4 p.m.",
        "type": "choice",
        "prompt": "What is being installed?",
        "options": [
          "New signs",
          "Security cameras",
          "Ticket machines",
          "New doors"
        ],
        "answer": 0,
        "explanationVi": "Lối vào đóng trong lúc lắp biển chỉ dẫn mới.",
        "explanation": "Lối vào đóng trong lúc lắp biển chỉ dẫn mới.",
        "evidence": "new signs are installed"
      },
      {
        "id": "toeic-l4-extra-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 4 · Talks",
        "title": "Visitor announcement",
        "audio": "./assets/study/audio/toeic-focus-l4.wav",
        "transcript": "Attention visitors: the west entrance is temporarily closed while new signs are installed. Please use the main entrance on King Street. The information desk can provide updated maps, and the west entrance is expected to reopen at 4 p.m.",
        "type": "choice",
        "prompt": "When should the west entrance open again?",
        "options": [
          "At noon",
          "At 2 p.m.",
          "At 4 p.m.",
          "Tomorrow morning"
        ],
        "answer": 2,
        "explanationVi": "Expected to reopen at 4 p.m. nghĩa là dự kiến mở lại lúc 4 giờ chiều.",
        "explanation": "Expected to reopen at 4 p.m. nghĩa là dự kiến mở lại lúc 4 giờ chiều.",
        "evidence": "the west entrance is expected to reopen at 4 p.m."
      },
      {
        "id": "toeic-part7-delayed-order-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Đơn hàng và lịch giao mới",
        "type": "choice",
        "prompt": "What will Linh most likely arrange?",
        "options": [
          "A temporary setup for the training",
          "A new purchase order",
          "A Thursday delivery",
          "A vehicle repair"
        ],
        "answer": 0,
        "explanation": "Email nêu phương án tạm nếu hàng đến thứ Sáu. Thông báo xác nhận điều kiện đó đã xảy ra.",
        "explanationVi": "Email nêu phương án tạm nếu hàng đến thứ Sáu. Thông báo xác nhận điều kiện đó đã xảy ra.",
        "evidence": "Email đặt hàng: If delivery moves to Friday. Thông báo: will arrive Friday at 9 a.m.",
        "documents": [
          {
            "title": "Email đặt hàng",
            "text": "Order #482: Please deliver 20 monitor stands to the East Office by Thursday at noon. Use the loading bay. If delivery moves to Friday, email Linh so she can arrange a temporary setup for Thursday’s training."
          },
          {
            "title": "Thông báo của nhà cung cấp",
            "text": "Order #482 will arrive Friday at 9 a.m. because of a vehicle breakdown. The quantity is unchanged. The East Office loading bay will be closed Friday morning. The driver will use the main reception desk."
          }
        ]
      },
      {
        "id": "toeic-part7-delayed-order-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Đơn hàng và lịch giao mới",
        "type": "choice",
        "prompt": "Where should staff now expect the driver?",
        "options": [
          "The loading bay",
          "The main reception desk",
          "The training room",
          "The West Office"
        ],
        "answer": 1,
        "explanation": "Email yêu cầu dùng cửa kho, nhưng thông báo mới đổi sang quầy lễ tân vì cửa kho đóng.",
        "explanationVi": "Email yêu cầu dùng cửa kho, nhưng thông báo mới đổi sang quầy lễ tân vì cửa kho đóng.",
        "evidence": "Email: Use the loading bay. Thông báo: use the main reception desk.",
        "documents": [
          {
            "title": "Email đặt hàng",
            "text": "Order #482: Please deliver 20 monitor stands to the East Office by Thursday at noon. Use the loading bay. If delivery moves to Friday, email Linh so she can arrange a temporary setup for Thursday’s training."
          },
          {
            "title": "Thông báo của nhà cung cấp",
            "text": "Order #482 will arrive Friday at 9 a.m. because of a vehicle breakdown. The quantity is unchanged. The East Office loading bay will be closed Friday morning. The driver will use the main reception desk."
          }
        ]
      },
      {
        "id": "toeic-part7-delayed-order-3",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Đơn hàng và lịch giao mới",
        "type": "choice",
        "prompt": "How many stands are expected?",
        "options": [
          "9",
          "12",
          "20",
          "48"
        ],
        "answer": 2,
        "explanation": "Email đặt 20 chiếc, thông báo xác nhận số lượng không đổi.",
        "explanationVi": "Email đặt 20 chiếc, thông báo xác nhận số lượng không đổi.",
        "evidence": "Email: 20 monitor stands. Thông báo: The quantity is unchanged.",
        "documents": [
          {
            "title": "Email đặt hàng",
            "text": "Order #482: Please deliver 20 monitor stands to the East Office by Thursday at noon. Use the loading bay. If delivery moves to Friday, email Linh so she can arrange a temporary setup for Thursday’s training."
          },
          {
            "title": "Thông báo của nhà cung cấp",
            "text": "Order #482 will arrive Friday at 9 a.m. because of a vehicle breakdown. The quantity is unchanged. The East Office loading bay will be closed Friday morning. The driver will use the main reception desk."
          }
        ]
      },
      {
        "id": "toeic-part7-delayed-order-4",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Đơn hàng và lịch giao mới",
        "type": "choice",
        "prompt": "What caused the delay?",
        "options": [
          "A stock shortage",
          "A closed office",
          "A missing address",
          "A vehicle breakdown"
        ],
        "answer": 3,
        "explanation": "Thông báo ghi xe gặp sự cố.",
        "explanationVi": "Thông báo ghi xe gặp sự cố.",
        "evidence": "Thông báo: because of a vehicle breakdown.",
        "documents": [
          {
            "title": "Email đặt hàng",
            "text": "Order #482: Please deliver 20 monitor stands to the East Office by Thursday at noon. Use the loading bay. If delivery moves to Friday, email Linh so she can arrange a temporary setup for Thursday’s training."
          },
          {
            "title": "Thông báo của nhà cung cấp",
            "text": "Order #482 will arrive Friday at 9 a.m. because of a vehicle breakdown. The quantity is unchanged. The East Office loading bay will be closed Friday morning. The driver will use the main reception desk."
          }
        ]
      },
      {
        "id": "toeic-part7-delayed-order-5",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Đơn hàng và lịch giao mới",
        "type": "choice",
        "prompt": "Which order is discussed?",
        "options": [
          "#428",
          "#482",
          "#248",
          "#824"
        ],
        "answer": 1,
        "explanation": "Cả hai văn bản ghi mã đơn #482.",
        "explanationVi": "Cả hai văn bản ghi mã đơn #482.",
        "evidence": "Cả hai văn bản: Order #482.",
        "documents": [
          {
            "title": "Email đặt hàng",
            "text": "Order #482: Please deliver 20 monitor stands to the East Office by Thursday at noon. Use the loading bay. If delivery moves to Friday, email Linh so she can arrange a temporary setup for Thursday’s training."
          },
          {
            "title": "Thông báo của nhà cung cấp",
            "text": "Order #482 will arrive Friday at 9 a.m. because of a vehicle breakdown. The quantity is unchanged. The East Office loading bay will be closed Friday morning. The driver will use the main reception desk."
          }
        ]
      },
      {
        "id": "toeic-part7-training-update-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Lịch đào tạo và bàn giao",
        "type": "choice",
        "prompt": "Where and when should Mai go?",
        "options": [
          "Room 2 at 10:00",
          "Room 5 at 11:00",
          "Room 4 at 14:00",
          "Room 5 at 14:00"
        ],
        "answer": 1,
        "explanation": "Mai thuộc kho nên học Inventory Basics theo lịch gốc. Email chuyển buổi đó sang phòng 5 lúc 11 giờ.",
        "explanationVi": "Mai thuộc kho nên học Inventory Basics theo lịch gốc. Email chuyển buổi đó sang phòng 5 lúc 11 giờ.",
        "evidence": "Tin nhắn: warehouse. Lịch: Inventory Basics for warehouse staff. Email: Room 5 at 11:00.",
        "documents": [
          {
            "title": "Lịch đào tạo",
            "text": "Tuesday 10:00: Inventory Basics, Room 2, for warehouse staff. Tuesday 14:00: Returns Processing, Room 4, for customer service staff. Bring a laptop to either session."
          },
          {
            "title": "Email cập nhật",
            "text": "Room 2 is unavailable on Tuesday morning. Inventory Basics will move to Room 5 at 11:00. Returns Processing will follow the original schedule."
          },
          {
            "title": "Tin nhắn của Mai",
            "text": "I work in the warehouse and will attend the session intended for my team. I will cover the dispatch desk until 10:30. Please tell me where and when to go after that."
          }
        ]
      },
      {
        "id": "toeic-part7-training-update-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Lịch đào tạo và bàn giao",
        "type": "choice",
        "prompt": "What should Mai bring?",
        "options": [
          "A visitor badge",
          "An inventory form",
          "A laptop",
          "A set of keys"
        ],
        "answer": 2,
        "explanation": "Lịch gốc yêu cầu mang laptop đến cả hai buổi. Email chỉ đổi giờ và phòng.",
        "explanationVi": "Lịch gốc yêu cầu mang laptop đến cả hai buổi. Email chỉ đổi giờ và phòng.",
        "evidence": "Lịch: Bring a laptop to either session.",
        "documents": [
          {
            "title": "Lịch đào tạo",
            "text": "Tuesday 10:00: Inventory Basics, Room 2, for warehouse staff. Tuesday 14:00: Returns Processing, Room 4, for customer service staff. Bring a laptop to either session."
          },
          {
            "title": "Email cập nhật",
            "text": "Room 2 is unavailable on Tuesday morning. Inventory Basics will move to Room 5 at 11:00. Returns Processing will follow the original schedule."
          },
          {
            "title": "Tin nhắn của Mai",
            "text": "I work in the warehouse and will attend the session intended for my team. I will cover the dispatch desk until 10:30. Please tell me where and when to go after that."
          }
        ]
      },
      {
        "id": "toeic-part7-training-update-3",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Lịch đào tạo và bàn giao",
        "type": "choice",
        "prompt": "Which session stays in Room 4?",
        "options": [
          "Inventory Basics",
          "Dispatch Training",
          "Both sessions",
          "Returns Processing"
        ],
        "answer": 3,
        "explanation": "Lịch ghi Returns Processing ở phòng 4, email xác nhận giữ lịch.",
        "explanationVi": "Lịch ghi Returns Processing ở phòng 4, email xác nhận giữ lịch.",
        "evidence": "Lịch: Returns Processing, Room 4. Email: original schedule.",
        "documents": [
          {
            "title": "Lịch đào tạo",
            "text": "Tuesday 10:00: Inventory Basics, Room 2, for warehouse staff. Tuesday 14:00: Returns Processing, Room 4, for customer service staff. Bring a laptop to either session."
          },
          {
            "title": "Email cập nhật",
            "text": "Room 2 is unavailable on Tuesday morning. Inventory Basics will move to Room 5 at 11:00. Returns Processing will follow the original schedule."
          },
          {
            "title": "Tin nhắn của Mai",
            "text": "I work in the warehouse and will attend the session intended for my team. I will cover the dispatch desk until 10:30. Please tell me where and when to go after that."
          }
        ]
      },
      {
        "id": "toeic-part7-training-update-4",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Lịch đào tạo và bàn giao",
        "type": "choice",
        "prompt": "What is Mai doing until 10:30?",
        "options": [
          "Covering the dispatch desk",
          "Attending a training session",
          "Setting up Room 5",
          "Processing refunds"
        ],
        "answer": 0,
        "explanation": "Mai nói cô sẽ trực bàn điều phối đến 10:30.",
        "explanationVi": "Mai nói cô sẽ trực bàn điều phối đến 10:30.",
        "evidence": "Tin nhắn: cover the dispatch desk until 10:30.",
        "documents": [
          {
            "title": "Lịch đào tạo",
            "text": "Tuesday 10:00: Inventory Basics, Room 2, for warehouse staff. Tuesday 14:00: Returns Processing, Room 4, for customer service staff. Bring a laptop to either session."
          },
          {
            "title": "Email cập nhật",
            "text": "Room 2 is unavailable on Tuesday morning. Inventory Basics will move to Room 5 at 11:00. Returns Processing will follow the original schedule."
          },
          {
            "title": "Tin nhắn của Mai",
            "text": "I work in the warehouse and will attend the session intended for my team. I will cover the dispatch desk until 10:30. Please tell me where and when to go after that."
          }
        ]
      },
      {
        "id": "toeic-part7-training-update-5",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Multiple passages",
        "title": "Lịch đào tạo và bàn giao",
        "type": "choice",
        "prompt": "Why was the morning session moved?",
        "options": [
          "The trainer was late",
          "Room 2 was unavailable",
          "Mai requested a later time",
          "The session required more laptops"
        ],
        "answer": 1,
        "explanation": "Email nêu phòng 2 không dùng được vào sáng thứ Ba.",
        "explanationVi": "Email nêu phòng 2 không dùng được vào sáng thứ Ba.",
        "evidence": "Email: Room 2 is unavailable on Tuesday morning.",
        "documents": [
          {
            "title": "Lịch đào tạo",
            "text": "Tuesday 10:00: Inventory Basics, Room 2, for warehouse staff. Tuesday 14:00: Returns Processing, Room 4, for customer service staff. Bring a laptop to either session."
          },
          {
            "title": "Email cập nhật",
            "text": "Room 2 is unavailable on Tuesday morning. Inventory Basics will move to Room 5 at 11:00. Returns Processing will follow the original schedule."
          },
          {
            "title": "Tin nhắn của Mai",
            "text": "I work in the warehouse and will attend the session intended for my team. I will cover the dispatch desk until 10:30. Please tell me where and when to go after that."
          }
        ]
      },
      {
        "id": "toeic-part6-returns-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Thông báo quy trình đổi trả",
        "type": "choice",
        "prompt": "Which word fits blank 1?",
        "options": [
          "submit",
          "submits",
          "submitted",
          "submitting"
        ],
        "answer": 0,
        "explanation": "Sau must dùng động từ nguyên mẫu.",
        "explanationVi": "Sau must dùng động từ nguyên mẫu.",
        "evidence": "Customers must [1] a return request.",
        "passage": "Customers must [1] a return request within 30 days. [2], include your order number. We will email you a prepaid shipping label. [3] Your refund will be processed [4] the warehouse receives the item."
      },
      {
        "id": "toeic-part6-returns-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Thông báo quy trình đổi trả",
        "type": "choice",
        "prompt": "Which phrase fits blank 2?",
        "options": [
          "Nevertheless",
          "In addition",
          "By contrast",
          "Meanwhile"
        ],
        "answer": 1,
        "explanation": "Câu sau bổ sung yêu cầu về mã đơn hàng.",
        "explanationVi": "Câu sau bổ sung yêu cầu về mã đơn hàng.",
        "evidence": "[2], include your order number.",
        "passage": "Customers must [1] a return request within 30 days. [2], include your order number. We will email you a prepaid shipping label. [3] Your refund will be processed [4] the warehouse receives the item."
      },
      {
        "id": "toeic-part6-returns-3",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Thông báo quy trình đổi trả",
        "type": "choice",
        "prompt": "Which sentence fits blank 3?",
        "options": [
          "Our office moved last year.",
          "The catalog lists six colors.",
          "Keep this label for your shipment.",
          "All orders require advance payment."
        ],
        "answer": 2,
        "explanation": "This label chỉ nhãn gửi trả vừa được nhắc ở câu trước.",
        "explanationVi": "This label chỉ nhãn gửi trả vừa được nhắc ở câu trước.",
        "evidence": "We will email you a prepaid shipping label. [3]",
        "passage": "Customers must [1] a return request within 30 days. [2], include your order number. We will email you a prepaid shipping label. [3] Your refund will be processed [4] the warehouse receives the item."
      },
      {
        "id": "toeic-part6-returns-4",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Thông báo quy trình đổi trả",
        "type": "choice",
        "prompt": "Which word fits blank 4?",
        "options": [
          "before",
          "unless",
          "until",
          "after"
        ],
        "answer": 3,
        "explanation": "Khoản hoàn tiền được xử lý sau khi kho nhận hàng.",
        "explanationVi": "Khoản hoàn tiền được xử lý sau khi kho nhận hàng.",
        "evidence": "Your refund will be processed [4] the warehouse receives the item.",
        "passage": "Customers must [1] a return request within 30 days. [2], include your order number. We will email you a prepaid shipping label. [3] Your refund will be processed [4] the warehouse receives the item."
      },
      {
        id: "toeic-r1", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 7 · Single passage", type: "choice", title: "Delivery update",
        passage: "To: All staff\nSubject: Supply delivery\nThe delivery of printer paper scheduled for Tuesday will arrive on Wednesday morning. The supplier has confirmed that the quantity and price are unchanged. Teams that need paper before then should collect one sealed box from the storage cupboard beside reception. Please record each box taken on the clipboard.",
        prompt: "What should staff do if they need paper before Wednesday?", options: ["Contact a different supplier", "Collect a box and record it", "Pay the supplier on Tuesday", "Wait at reception for the delivery"], answer: 1,
        explanation: "The notice directs staff to collect one sealed box from the cupboard and record it on the clipboard.",
        explanationVi: "Nhân viên cần lấy một hộp giấy và ghi lại trên bảng kê.",
      },
      {
        "id": "toeic-r1-extra-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Single passage",
        "title": "Delivery update",
        "passage": "To: All staff\nSubject: Supply delivery\nThe delivery of printer paper scheduled for Tuesday will arrive on Wednesday morning. The supplier has confirmed that the quantity and price are unchanged. Teams that need paper before then should collect one sealed box from the storage cupboard beside reception. Please record each box taken on the clipboard.",
        "type": "choice",
        "prompt": "When will the delivery now arrive?",
        "options": [
          "Tuesday morning",
          "Tuesday afternoon",
          "Wednesday morning",
          "Wednesday evening"
        ],
        "answer": 2,
        "explanationVi": "Lịch giao chuyển từ thứ Ba sang sáng thứ Tư.",
        "explanation": "Lịch giao chuyển từ thứ Ba sang sáng thứ Tư.",
        "evidence": "will arrive on Wednesday morning"
      },
      {
        "id": "toeic-r1-extra-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Single passage",
        "title": "Delivery update",
        "passage": "To: All staff\nSubject: Supply delivery\nThe delivery of printer paper scheduled for Tuesday will arrive on Wednesday morning. The supplier has confirmed that the quantity and price are unchanged. Teams that need paper before then should collect one sealed box from the storage cupboard beside reception. Please record each box taken on the clipboard.",
        "type": "choice",
        "prompt": "What did the supplier confirm?",
        "options": [
          "The quantity and price are unchanged",
          "The order was canceled",
          "The paper costs less",
          "Extra boxes will arrive"
        ],
        "answer": 0,
        "explanationVi": "Nhà cung cấp xác nhận số lượng và giá vẫn giữ nguyên.",
        "explanation": "Nhà cung cấp xác nhận số lượng và giá vẫn giữ nguyên.",
        "evidence": "the quantity and price are unchanged"
      },
      {
        "id": "toeic-r1-extra-3",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Single passage",
        "title": "Delivery update",
        "passage": "To: All staff\nSubject: Supply delivery\nThe delivery of printer paper scheduled for Tuesday will arrive on Wednesday morning. The supplier has confirmed that the quantity and price are unchanged. Teams that need paper before then should collect one sealed box from the storage cupboard beside reception. Please record each box taken on the clipboard.",
        "type": "choice",
        "prompt": "Where is the storage cupboard?",
        "options": [
          "Next to reception",
          "In the car park",
          "Inside the mailroom",
          "Beside the loading dock"
        ],
        "answer": 0,
        "explanationVi": "Beside reception tương đương next to reception.",
        "explanation": "Beside reception tương đương next to reception.",
        "evidence": "the storage cupboard beside reception"
      },
      {
        "id": "toeic-r1-extra-4",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 7 · Single passage",
        "title": "Delivery update",
        "passage": "To: All staff\nSubject: Supply delivery\nThe delivery of printer paper scheduled for Tuesday will arrive on Wednesday morning. The supplier has confirmed that the quantity and price are unchanged. Teams that need paper before then should collect one sealed box from the storage cupboard beside reception. Please record each box taken on the clipboard.",
        "type": "choice",
        "prompt": "What is the main purpose of the notice?",
        "options": [
          "To request new suppliers",
          "To explain a delivery delay and a temporary option",
          "To announce a price increase",
          "To remind staff to place an order"
        ],
        "answer": 1,
        "explanationVi": "Thông báo nêu lịch giao mới và cách lấy giấy trong lúc chờ.",
        "explanation": "Thông báo nêu lịch giao mới và cách lấy giấy trong lúc chờ.",
        "evidence": "Teams that need paper before then should collect one sealed box"
      },
      {
        id: "toeic-r2", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 7 · Single passage", type: "choice", title: "Training registration",
        passage: "Employees may register for the customer-service workshop through the internal learning page until 5 p.m. on 12 June. The session is free, but places are limited to 18 participants. Staff who need to cancel should notify the training team at least one working day in advance so a colleague can take the place.",
        prompt: "Why should an employee notify the training team about a cancellation?", options: ["To receive a refund", "So another colleague can use the place", "To change the workshop date", "Because registration closes early"], answer: 1,
        explanation: "The passage explains that advance notice allows a colleague to take the participant’s place.",
        explanationVi: "Báo hủy sớm để đồng nghiệp khác có thể tham dự.",
      },
      {
        id: "toeic-r3", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 5 · Incomplete sentences", type: "choice", title: "Grammar in context",
        passage: "The design team has ------- the revised brochure to the printer.", prompt: "Choose the word that completes the sentence.", options: ["submit", "submitted", "submitting", "submission"], answer: 1,
        explanation: "The present perfect uses has followed by the past participle submitted.",
      },
      {
        id: "toeic-r4", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 6 · Text completion", type: "choice", title: "Customer notice",
        passage: "Our service counter will [1] at 3 p.m. on Friday for scheduled maintenance. [2] The closure is temporary. [3], online orders can still be placed as usual. The counter will reopen [4] 9 a.m. on Monday.",
        prompt: "Which sentence fits blank 2?", options: ["We apologize for any inconvenience this may cause.", "The new counter opened several years ago.", "Please submit your order to the warehouse last month.", "All employees have completed the survey."], answer: 0,
        explanation: "An apology for temporary closure fits the notice; the other sentences do not connect to its purpose or timeline.",
        explanationVi: "Câu xin lỗi phù hợp với thông báo quầy tạm đóng để bảo trì.",
      },
      {
        "id": "toeic-r4-extra-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Customer notice",
        "passage": "Our service counter will [1] at 3 p.m. on Friday for scheduled maintenance. [2] The closure is temporary. [3], online orders can still be placed as usual. The counter will reopen [4] 9 a.m. on Monday.",
        "type": "choice",
        "prompt": "Which word fits blank 1?",
        "options": [
          "close",
          "closed",
          "closing",
          "closure"
        ],
        "answer": 0,
        "explanationVi": "Sau will dùng động từ nguyên mẫu close.",
        "explanation": "Sau will dùng động từ nguyên mẫu close.",
        "evidence": "The closure is temporary."
      },
      {
        "id": "toeic-r4-extra-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Customer notice",
        "passage": "Our service counter will [1] at 3 p.m. on Friday for scheduled maintenance. [2] The closure is temporary. [3], online orders can still be placed as usual. The counter will reopen [4] 9 a.m. on Monday.",
        "type": "choice",
        "prompt": "Which phrase fits blank 3?",
        "options": [
          "As a result",
          "In the meantime",
          "For instance",
          "In the past"
        ],
        "answer": 1,
        "explanationVi": "In the meantime nói về khoảng thời gian quầy đang đóng.",
        "explanation": "In the meantime nói về khoảng thời gian quầy đang đóng.",
        "evidence": "Online orders can still be placed as usual"
      },
      {
        "id": "toeic-r4-extra-3",
        "exam": "TOEIC Listening & Reading",
        "skill": "Reading",
        "part": "Part 6 · Text completion",
        "title": "Customer notice",
        "passage": "Our service counter will [1] at 3 p.m. on Friday for scheduled maintenance. [2] The closure is temporary. [3], online orders can still be placed as usual. The counter will reopen [4] 9 a.m. on Monday.",
        "type": "choice",
        "prompt": "Which word fits blank 4?",
        "options": [
          "since",
          "during",
          "at",
          "from"
        ],
        "answer": 2,
        "explanationVi": "Dùng at trước giờ cụ thể: at 9 a.m.",
        "explanation": "Dùng at trước giờ cụ thể: at 9 a.m.",
        "evidence": "9 a.m. on Monday"
      },
      {
        id: "ia-r5", exam: "IELTS Academic", skill: "Reading", part: "Reading · Matching information", type: "choice", title: "Restoring salt marshes", pathwayStage: "band-6", focus: "Trace the condition that explains why a habitat becomes squeezed.",
        passage: "Salt marshes form where sheltered coastlines allow salt-tolerant plants to take root. Their stems slow moving water and trap sediment, gradually building a platform. In places where roads or walls prevent the marsh from moving inland as sea levels rise, the habitat can become squeezed into a narrower strip. Restoration projects therefore sometimes remove barriers on the landward side. Success is measured over years: early planting may fail if currents are too strong, and a naturally colonised site can prove more resilient than one planted densely at the outset.",
        prompt: "Why might restoration teams remove barriers behind a salt marsh?", options: ["To give the habitat space to move inland as sea level rises.", "To increase the speed of coastal currents.", "To stop salt-tolerant plants from spreading.", "To make early planting more dense."], answer: 0,
        explanation: "The passage says roads and walls can block inland movement, so removing barriers can reduce this squeeze.",
      },
      {
        id: "ia-r6", exam: "IELTS Academic", skill: "Reading", part: "Reading · True/False/Not Given", type: "choice", title: "Restoring salt marshes", pathwayStage: "band-6", focus: "Compare the certainty of the statement with the passage’s qualifier ‘can’.",
        passage: "Salt marshes form where sheltered coastlines allow salt-tolerant plants to take root. Their stems slow moving water and trap sediment, gradually building a platform. In places where roads or walls prevent the marsh from moving inland as sea levels rise, the habitat can become squeezed into a narrower strip. Restoration projects therefore sometimes remove barriers on the landward side. Success is measured over years: early planting may fail if currents are too strong, and a naturally colonised site can prove more resilient than one planted densely at the outset.",
        prompt: "The passage states that naturally colonised marshes are always more resilient than planted ones.", options: ["True", "False", "Not Given"], answer: 1,
        explanation: "The text says a naturally colonised site can prove more resilient in some cases; it does not say always.",
      },
      {
        id: "ia-r7", exam: "IELTS Academic", skill: "Reading", part: "Reading · Sentence completion", type: "short-answer", title: "Restoring salt marshes", pathwayStage: "band-6", focus: "Identify the main verb and the object it acts on.",
        passage: "Salt marshes form where sheltered coastlines allow salt-tolerant plants to take root. Their stems slow moving water and trap sediment, gradually building a platform. In places where roads or walls prevent the marsh from moving inland as sea levels rise, the habitat can become squeezed into a narrower strip. Restoration projects therefore sometimes remove barriers on the landward side. Success is measured over years: early planting may fail if currents are too strong, and a naturally colonised site can prove more resilient than one planted densely at the outset.",
        prompt: "What do marsh plant stems trap to help build a platform? (One word.)", acceptedAnswers: ["sediment"],
        explanation: "The second sentence states that the stems trap sediment.",
      },
      {
        id: "ia-r8", exam: "IELTS Academic", skill: "Reading", part: "Reading · Multiple choice", type: "choice", title: "Restoring salt marshes", pathwayStage: "band-6", focus: "Combine the long-term measure with the early-planting limitation.",
        passage: "Salt marshes form where sheltered coastlines allow salt-tolerant plants to take root. Their stems slow moving water and trap sediment, gradually building a platform. In places where roads or walls prevent the marsh from moving inland as sea levels rise, the habitat can become squeezed into a narrower strip. Restoration projects therefore sometimes remove barriers on the landward side. Success is measured over years: early planting may fail if currents are too strong, and a naturally colonised site can prove more resilient than one planted densely at the outset.",
        prompt: "What does the passage suggest about evaluating a restoration project?", options: ["It requires observation over an extended period.", "It can be judged from the number of plants added on day one.", "It depends only on whether a road is removed.", "It should ignore the strength of local currents."], answer: 0,
        explanation: "The passage explicitly says success is measured over years and notes that early planting may fail.",
      },
      {
        id: "ia-l4", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 1 · Form completion", type: "gap-fill", title: "Fieldwork briefing", pathwayStage: "band-6", focus: "Track a changed date and collect the corrected time and place.",
        transcript: "Good morning. The coastal ecology group will leave campus on Tuesday, not Monday, because the tide is unsuitable at the start of the week. Meet at the east entrance at 7:40. The minibus cannot take large bags, so bring a small backpack and a refillable water bottle. We will return by 4:30. If you have a food allergy, email Dr Patel before Friday so she can arrange lunch.",
        prompt: "Complete the fieldwork notes. (Use one or two words for each gap.)", gaps: [{ id: "day", label: "Departure day", acceptedAnswers: ["Tuesday"] }, { id: "entrance", label: "Meeting point", acceptedAnswers: ["east entrance", "the east entrance"] }, { id: "time", label: "Meet at", acceptedAnswers: ["7:40", "seven forty"] }],
        explanation: "The speaker gives Tuesday, the east entrance and 7:40 as the departure details.",
      },
      {
        id: "ia-l5", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 1 · Form completion", type: "short-answer", title: "Fieldwork briefing", pathwayStage: "band-6", focus: "Listen for the purpose of an item, not only its category.",
        transcript: "Good morning. The coastal ecology group will leave campus on Tuesday, not Monday, because the tide is unsuitable at the start of the week. Meet at the east entrance at 7:40. The minibus cannot take large bags, so bring a small backpack and a refillable water bottle. We will return by 4:30. If you have a food allergy, email Dr Patel before Friday so she can arrange lunch.",
        prompt: "What should students bring to drink? (Up to three words.)", acceptedAnswers: ["a refillable water bottle", "refillable water bottle"],
        explanation: "The speaker asks students to bring a refillable water bottle.",
      },
      {
        id: "ia-l6", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 1 · Multiple choice", type: "choice", title: "Fieldwork briefing", pathwayStage: "band-6", focus: "Connect the reason to the schedule change rather than a later detail.",
        transcript: "Good morning. The coastal ecology group will leave campus on Tuesday, not Monday, because the tide is unsuitable at the start of the week. Meet at the east entrance at 7:40. The minibus cannot take large bags, so bring a small backpack and a refillable water bottle. We will return by 4:30. If you have a food allergy, email Dr Patel before Friday so she can arrange lunch.",
        prompt: "Why was the trip moved from Monday?", options: ["The tide conditions are unsuitable.", "The minibus is being repaired.", "The group has no guide.", "The campus is closed."], answer: 0,
        explanation: "The speaker says the tide is unsuitable at the start of the week.",
      },
      {
        id: "ia-l7", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 1 · Short answer", type: "short-answer", title: "Fieldwork briefing", pathwayStage: "band-6", focus: "Catch the person’s title and surname from the final instruction.",
        transcript: "Good morning. The coastal ecology group will leave campus on Tuesday, not Monday, because the tide is unsuitable at the start of the week. Meet at the east entrance at 7:40. The minibus cannot take large bags, so bring a small backpack and a refillable water bottle. We will return by 4:30. If you have a food allergy, email Dr Patel before Friday so she can arrange lunch.",
        prompt: "Who should students contact about a food allergy? (Title and surname.)", acceptedAnswers: ["Dr Patel", "Doctor Patel"],
        explanation: "The final sentence asks students to email Dr Patel.",
      },
      {
        id: "ia-r9", exam: "IELTS Academic", skill: "Reading", part: "Reading · Multiple choice", type: "choice", title: "Monitoring restored wetlands",
        pathwayStage: "band-6-5", focus: "Combine the study design with its stated limits before choosing the researchers’ conclusion.",
        passage: "Urban wetland projects are increasingly assessed through several kinds of evidence. Earlier surveys relied mainly on volunteers counting birds, but results varied with the observer and the season. A recent study added acoustic sensors, which recorded calls at night when field teams were absent. The devices widened the observation window, although they could not distinguish every species with similar calls. Researchers therefore combined recordings with monthly site visits. Across twelve ponds monitored for three years, nocturnal activity rose at restored sites. Overall species richness, however, did not rise uniformly: the clearest gains occurred where shorelines had gentle slopes and nearby artificial lighting had been reduced. The authors caution that the pattern does not prove either change caused the gains, because restoration measures were introduced together and the sites were not randomly assigned.",
        prompt: "Why did researchers add acoustic sensors to the monitoring process?", options: ["To record wildlife activity at times when observers were not present.", "To identify every species without needing site visits.", "To make the restored ponds randomly assigned.", "To measure how volunteers changed the shoreline."], answer: 0,
        explanation: "The passage says sensors recorded calls at night when field teams were absent. Their limits meant the team still combined them with site visits.",
      },
      {
        id: "ia-r10", exam: "IELTS Academic", skill: "Reading", part: "Reading · True/False/Not Given", type: "choice", title: "Monitoring restored wetlands",
        pathwayStage: "band-6-5", focus: "Check whether the passage supports the full strength of a statement, not just a related detail.",
        passage: "Urban wetland projects are increasingly assessed through several kinds of evidence. Earlier surveys relied mainly on volunteers counting birds, but results varied with the observer and the season. A recent study added acoustic sensors, which recorded calls at night when field teams were absent. The devices widened the observation window, although they could not distinguish every species with similar calls. Researchers therefore combined recordings with monthly site visits. Across twelve ponds monitored for three years, nocturnal activity rose at restored sites. Overall species richness, however, did not rise uniformly: the clearest gains occurred where shorelines had gentle slopes and nearby artificial lighting had been reduced. The authors caution that the pattern does not prove either change caused the gains, because restoration measures were introduced together and the sites were not randomly assigned.",
        prompt: "The acoustic sensors could reliably distinguish every species that made similar calls.", options: ["True", "False", "Not Given"], answer: 1,
        explanation: "The passage directly says the devices could not distinguish every species with similar calls, so the statement is contradicted.",
      },
      {
        id: "ia-r11", exam: "IELTS Academic", skill: "Reading", part: "Reading · Sentence completion", type: "short-answer", title: "Monitoring restored wetlands",
        pathwayStage: "band-6-5", focus: "Trace the outcome to the exact conditions linked with the clearest gains.",
        passage: "Urban wetland projects are increasingly assessed through several kinds of evidence. Earlier surveys relied mainly on volunteers counting birds, but results varied with the observer and the season. A recent study added acoustic sensors, which recorded calls at night when field teams were absent. The devices widened the observation window, although they could not distinguish every species with similar calls. Researchers therefore combined recordings with monthly site visits. Across twelve ponds monitored for three years, nocturnal activity rose at restored sites. Overall species richness, however, did not rise uniformly: the clearest gains occurred where shorelines had gentle slopes and nearby artificial lighting had been reduced. The authors caution that the pattern does not prove either change caused the gains, because restoration measures were introduced together and the sites were not randomly assigned.",
        prompt: "What kind of shorelines were linked to the clearest gains? (Use up to three words.)", acceptedAnswers: ["gentle slopes", "gentle shoreline slopes"],
        explanation: "The passage links the clearest gains with shorelines that had gentle slopes and reduced nearby artificial lighting.",
      },
      {
        id: "ia-r12", exam: "IELTS Academic", skill: "Reading", part: "Reading · Multiple choice", type: "choice", title: "Monitoring restored wetlands",
        pathwayStage: "band-6-5", focus: "Separate an observed association from a proven cause by following the final qualification.",
        passage: "Urban wetland projects are increasingly assessed through several kinds of evidence. Earlier surveys relied mainly on volunteers counting birds, but results varied with the observer and the season. A recent study added acoustic sensors, which recorded calls at night when field teams were absent. The devices widened the observation window, although they could not distinguish every species with similar calls. Researchers therefore combined recordings with monthly site visits. Across twelve ponds monitored for three years, nocturnal activity rose at restored sites. Overall species richness, however, did not rise uniformly: the clearest gains occurred where shorelines had gentle slopes and nearby artificial lighting had been reduced. The authors caution that the pattern does not prove either change caused the gains, because restoration measures were introduced together and the sites were not randomly assigned.",
        prompt: "Why do the authors avoid claiming that the restoration measures caused the gains?", options: ["The measures were introduced together, and the sites were not randomly assigned.", "The project collected data only during one season.", "Nocturnal activity fell at every restored pond.", "The volunteers counted more species than the sensors could record."], answer: 0,
        explanation: "The final sentence gives both limitations: the measures changed together and the sites were not randomly assigned, so cause cannot be isolated.",
      },
      {
        id: "ia-l8", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 3 · Multiple choice", type: "choice", title: "Urban shade research briefing",
        pathwayStage: "band-6-5", focus: "Follow the correction and the reason attached to the final choice, not the first number heard.",
        transcript: "For the walking-route study, we first planned to monitor twenty routes. We have reduced that to twelve, not because the other routes were unsuitable, but because the team can collect reliable readings from twelve within the four-week field period. We will measure surface temperature at nine in the morning and again at two in the afternoon. We will leave out days after heavy rain, since wet paving changes the readings. The early data show cooler afternoon surfaces on routes with mature tree cover, but only where tall buildings do not block the wind. Because the routes were not randomly selected, we cannot say trees alone caused the difference. In the next phase, we will interview residents to check whether the measured changes match how comfortable the routes feel.",
        prompt: "Why did the researchers reduce the sample from twenty routes to twelve?", options: ["They can collect reliable readings from twelve during the available field period.", "The other routes were damaged by heavy rain.", "The team found that only twelve routes had trees.", "Residents refused to take part in the temperature measurements."], answer: 0,
        explanation: "The speaker corrects the likely assumption: the other routes were not unsuitable; twelve fit the four-week collection period.",
      },
      {
        id: "ia-l9", exam: "IELTS Academic", skill: "Listening", part: "Listening · Note completion", type: "gap-fill", title: "Urban shade research briefing",
        pathwayStage: "band-6-5", focus: "Predict a time field, then capture the exact time expression as it is spoken.",
        transcript: "For the walking-route study, we first planned to monitor twenty routes. We have reduced that to twelve, not because the other routes were unsuitable, but because the team can collect reliable readings from twelve within the four-week field period. We will measure surface temperature at nine in the morning and again at two in the afternoon. We will leave out days after heavy rain, since wet paving changes the readings. The early data show cooler afternoon surfaces on routes with mature tree cover, but only where tall buildings do not block the wind. Because the routes were not randomly selected, we cannot say trees alone caused the difference. In the next phase, we will interview residents to check whether the measured changes match how comfortable the routes feel.",
        prompt: "Complete the research notes. (Use one or two words for each gap.)", gaps: [{ id: "morning", label: "First temperature reading", acceptedAnswers: ["nine", "9", "9 a.m.", "nine in the morning"] }, { id: "afternoon", label: "Second temperature reading", acceptedAnswers: ["two", "2", "2 p.m.", "two in the afternoon"] }],
        explanation: "The speaker gives the two collection times as nine in the morning and two in the afternoon.",
      },
      {
        id: "ia-l10", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 3 · Multiple choice", type: "choice", title: "Urban shade research briefing",
        pathwayStage: "band-6-5", focus: "Use the speaker’s qualification to distinguish correlation from a causal claim.",
        transcript: "For the walking-route study, we first planned to monitor twenty routes. We have reduced that to twelve, not because the other routes were unsuitable, but because the team can collect reliable readings from twelve within the four-week field period. We will measure surface temperature at nine in the morning and again at two in the afternoon. We will leave out days after heavy rain, since wet paving changes the readings. The early data show cooler afternoon surfaces on routes with mature tree cover, but only where tall buildings do not block the wind. Because the routes were not randomly selected, we cannot say trees alone caused the difference. In the next phase, we will interview residents to check whether the measured changes match how comfortable the routes feel.",
        prompt: "What limitation does the speaker identify about the early results?", options: ["The route selection does not allow the team to attribute the difference to trees alone.", "The temperature readings were taken only after heavy rain.", "The trees prevented the team from measuring surface temperature.", "The results show that every route became cooler."], answer: 0,
        explanation: "The routes were not randomly selected, so other differences may explain the association; the speaker explicitly avoids attributing the effect to trees alone.",
      },
      {
        id: "ia-l11", exam: "IELTS Academic", skill: "Listening", part: "Listening · Part 3 · Short answer", type: "short-answer", title: "Urban shade research briefing",
        pathwayStage: "band-6-5", focus: "Listen for the purpose of the next research phase rather than a measurement detail.",
        transcript: "For the walking-route study, we first planned to monitor twenty routes. We have reduced that to twelve, not because the other routes were unsuitable, but because the team can collect reliable readings from twelve within the four-week field period. We will measure surface temperature at nine in the morning and again at two in the afternoon. We will leave out days after heavy rain, since wet paving changes the readings. The early data show cooler afternoon surfaces on routes with mature tree cover, but only where tall buildings do not block the wind. Because the routes were not randomly selected, we cannot say trees alone caused the difference. In the next phase, we will interview residents to check whether the measured changes match how comfortable the routes feel.",
        prompt: "What will interviews help the team compare with its measurements? (Use up to three words.)", acceptedAnswers: ["residents' comfort", "how comfortable routes feel", "residents’ comfort", "perceived comfort"],
        explanation: "The next phase checks whether measured changes match residents’ sense of how comfortable the routes feel.",
      },
      {
        id: "toeic-l5", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 2 · Question–Response", type: "choice", title: "Conference room",
        transcript: "Woman: Has the conference room been reserved for the client meeting? Man: Yes, I booked it for Thursday afternoon.",
        prompt: "When is the room booked?", options: ["Thursday afternoon", "Tomorrow morning", "At the front desk", "For a training course"], answer: 0,
        explanation: "The response confirms a booking for Thursday afternoon.",
      },
      {
        id: "toeic-l6", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 2 · Question–Response", type: "choice", title: "Updated invoice",
        transcript: "Man: Who can send me the updated invoice? Woman: Please ask Minh in the accounts department.",
        prompt: "Who should the man contact?", options: ["A courier", "Minh in accounts", "The building manager", "A new client"], answer: 1,
        explanation: "The woman directs him to Minh in the accounts department.",
      },
      {
        id: "toeic-l7", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 3 · Conversations", type: "choice", title: "Equipment delivery",
        transcript: "Man: The new scanners were due this morning, but the supplier called to say the shipment is delayed. Woman: Do they know when it will arrive? Man: Friday before noon. I will move the installation team to the west branch tomorrow and ask reception to keep the loading area clear on Friday.",
        prompt: "When is the shipment expected?", options: ["Tomorrow morning", "Friday before noon", "Friday afternoon", "Next week"], answer: 1,
        audio: "./assets/study/audio/toeic-delivery.wav",
        evidence: "Friday before noon.",
        explanationVi: "Hàng sẽ đến trước 12 giờ trưa thứ Sáu.",
        distractorsVi: ["Ngày mai là lúc đội lắp đặt chuyển chi nhánh.", "", "Before noon là trước buổi trưa.", "Người nói xác nhận thứ Sáu, không nói tuần sau."],
        followUp: { prompt: "The courier will arrive Tuesday before noon. When should you expect the courier?", options: ["Tuesday morning", "Tuesday afternoon"], answer: 0, explanation: "Before noon nghĩa là trước 12 giờ trưa." },
        explanation: "The speaker says the shipment is expected Friday before noon.",
      },
      {
        "id": "toeic-delivery-team",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 3 · Conversations",
        "type": "choice",
        "title": "Equipment delivery",
        transcript: "Man: The new scanners were due this morning, but the supplier called to say the shipment is delayed. Woman: Do they know when it will arrive? Man: Friday before noon. I will move the installation team to the west branch tomorrow and ask reception to keep the loading area clear on Friday.",
        "prompt": "What will the installation team do tomorrow?",
        "options": [
          "Clear the loading area",
          "Install the scanners",
          "Work at the west branch",
          "Call the supplier"
        ],
        "answer": 2,
        "evidence": "I will move the installation team to the west branch tomorrow and ask reception to keep the loading area clear on Friday.",
        "explanation": "Đội lắp đặt sẽ chuyển sang chi nhánh phía tây vào ngày mai.",
        "explanationVi": "Đội lắp đặt sẽ chuyển sang chi nhánh phía tây vào ngày mai.",
        "distractorsVi": [
          "Việc giữ khu dỡ hàng thông thoáng được giao cho lễ tân.",
          "Máy chưa được giao nên không có lịch lắp đặt vào ngày mai.",
          "",
          "Nhà cung cấp đã gọi báo trễ. Đội lắp đặt không được giao gọi lại."
        ],
        "audio": "./assets/study/audio/toeic-delivery.wav",
        "followUp": {
          "prompt": "The technician will work at the north branch on Monday. Where will she work on Monday?",
          "options": [
            "At reception",
            "At the north branch"
          ],
          "answer": 1,
          "explanation": "North branch là chi nhánh phía bắc."
        }
      },
      {
        "id": "toeic-delivery-reception",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 3 · Conversations",
        "type": "choice",
        "title": "Equipment delivery",
        transcript: "Man: The new scanners were due this morning, but the supplier called to say the shipment is delayed. Woman: Do they know when it will arrive? Man: Friday before noon. I will move the installation team to the west branch tomorrow and ask reception to keep the loading area clear on Friday.",
        "prompt": "What will reception be asked to do?",
        "options": [
          "Keep the loading area clear",
          "Move the installation team",
          "Deliver the scanners",
          "Repair the scanners"
        ],
        "answer": 0,
        "evidence": "I will move the installation team to the west branch tomorrow and ask reception to keep the loading area clear on Friday.",
        "explanation": "Lễ tân được nhờ giữ khu dỡ hàng thông thoáng vào thứ Sáu.",
        "explanationVi": "Lễ tân được nhờ giữ khu dỡ hàng thông thoáng vào thứ Sáu.",
        "distractorsVi": [
          "",
          "Người nói sẽ chuyển đội lắp đặt. Đây không phải việc của lễ tân.",
          "Nhà cung cấp giao máy. Lễ tân chỉ chuẩn bị khu dỡ hàng.",
          "Đoạn nghe nói giao hàng trễ, không nói máy bị hỏng."
        ],
        "audio": "./assets/study/audio/toeic-delivery.wav",
        "followUp": {
          "prompt": "Please ask security to keep the entrance clear. What should security do?",
          "options": [
            "Keep the entrance clear",
            "Deliver the equipment"
          ],
          "answer": 0,
          "explanation": "Security được giao giữ lối vào thông thoáng."
        }
      },
      ...[
  {
    "id": "toeic-training-room-1",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Đổi phòng đào tạo",
    "transcript": "Man: The projector in room two isn't working. Can we move this afternoon's safety training? Woman: Yes. Room six is available at two thirty. I'll email the participants before lunch. Man: Thanks. I'll put a sign on the door of room two so no one waits there.",
    "prompt": "Why is the training being moved?",
    "options": [
      "A projector is broken",
      "The trainer is late",
      "The room is too small",
      "The training was canceled"
    ],
    "answer": 0,
    "audio": "./assets/study/audio/toeic-training-room.wav",
    "evidence": "The projector in room two isn't working.",
    "explanationVi": "Máy chiếu phòng 2 bị hỏng nên cần đổi phòng.",
    "explanation": "The projector in room two isn't working.",
    "followUp": {
      "prompt": "The printer isn't working. Why will the team use another printer?",
      "options": [
        "The first printer is broken",
        "They ran out of paper"
      ],
      "answer": 0,
      "explanation": "Isn’t working nghĩa là thiết bị không hoạt động."
    }
  },
  {
    "id": "toeic-training-room-2",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Đổi phòng đào tạo",
    "transcript": "Man: The projector in room two isn't working. Can we move this afternoon's safety training? Woman: Yes. Room six is available at two thirty. I'll email the participants before lunch. Man: Thanks. I'll put a sign on the door of room two so no one waits there.",
    "prompt": "Where will the training take place?",
    "options": [
      "Room two",
      "Room three",
      "Room six",
      "The lobby"
    ],
    "answer": 2,
    "audio": "./assets/study/audio/toeic-training-room.wav",
    "evidence": "Room six is available at two thirty.",
    "explanationVi": "Phòng 6 trống lúc 2 giờ 30 và được chọn thay phòng 2.",
    "explanation": "Room six is available at two thirty.",
    "followUp": {
      "prompt": "Room nine is available, so we will move the meeting there. Where is the meeting?",
      "options": [
        "Room nine",
        "Room six"
      ],
      "answer": 0,
      "explanation": "There chỉ địa điểm vừa nhắc đến: phòng 9."
    }
  },
  {
    "id": "toeic-training-room-3",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Đổi phòng đào tạo",
    "transcript": "Man: The projector in room two isn't working. Can we move this afternoon's safety training? Woman: Yes. Room six is available at two thirty. I'll email the participants before lunch. Man: Thanks. I'll put a sign on the door of room two so no one waits there.",
    "prompt": "What will the second speaker do before lunch?",
    "options": [
      "Fix the projector",
      "Print a sign",
      "Set up the chairs",
      "Email the participants"
    ],
    "answer": 3,
    "audio": "./assets/study/audio/toeic-training-room.wav",
    "evidence": "I'll email the participants before lunch.",
    "explanationVi": "Người nói thứ hai sẽ gửi email cho người tham dự trước giờ ăn trưa.",
    "explanation": "I'll email the participants before lunch.",
    "followUp": {
      "prompt": "I’ll call the visitors before lunch. What will I do?",
      "options": [
        "Call the visitors",
        "Send a letter"
      ],
      "answer": 0,
      "explanation": "Call là gọi điện."
    }
  },
  {
    "id": "toeic-invoice-correction-1",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Sửa hóa đơn",
    "transcript": "Man: Hi, I'm checking invoice forty-eight. It lists twelve boxes, but we received ten. Woman: You're right. Two boxes were removed from the order. I'll send a corrected invoice this afternoon. Man: Thank you. Our accounting team will wait for the revised invoice before paying.",
    "prompt": "Why is the caller asking about the invoice?",
    "options": [
      "The price was missing",
      "The delivery was late",
      "The quantity was incorrect",
      "The payment was rejected"
    ],
    "answer": 2,
    "audio": "./assets/study/audio/toeic-invoice-correction.wav",
    "evidence": "It lists twelve boxes, but we received ten.",
    "explanationVi": "Hóa đơn ghi 12 hộp nhưng thực nhận 10 hộp.",
    "explanation": "It lists twelve boxes, but we received ten.",
    "followUp": {
      "prompt": "The form says six chairs, but we ordered four. What is wrong?",
      "options": [
        "The delivery address",
        "The quantity"
      ],
      "answer": 1,
      "explanation": "Số lượng trên biểu mẫu khác số đã đặt."
    }
  },
  {
    "id": "toeic-invoice-correction-2",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Sửa hóa đơn",
    "transcript": "Man: Hi, I'm checking invoice forty-eight. It lists twelve boxes, but we received ten. Woman: You're right. Two boxes were removed from the order. I'll send a corrected invoice this afternoon. Man: Thank you. Our accounting team will wait for the revised invoice before paying.",
    "prompt": "What will the second speaker send this afternoon?",
    "options": [
      "A corrected invoice",
      "Two boxes",
      "A payment receipt",
      "A new contract"
    ],
    "answer": 0,
    "audio": "./assets/study/audio/toeic-invoice-correction.wav",
    "evidence": "I'll send a corrected invoice this afternoon.",
    "explanationVi": "Người nói thứ hai sẽ gửi hóa đơn đã chỉnh sửa chiều nay.",
    "explanation": "I'll send a corrected invoice this afternoon.",
    "followUp": {
      "prompt": "I’ll send a revised schedule after lunch. What will I send?",
      "options": [
        "An updated schedule",
        "A payment receipt"
      ],
      "answer": 0,
      "explanation": "Revised nghĩa là đã chỉnh sửa."
    }
  },
  {
    "id": "toeic-invoice-correction-3",
    "exam": "TOEIC Listening & Reading",
    "skill": "Listening",
    "part": "Part 3 · Conversations",
    "type": "choice",
    "title": "Sửa hóa đơn",
    "transcript": "Man: Hi, I'm checking invoice forty-eight. It lists twelve boxes, but we received ten. Woman: You're right. Two boxes were removed from the order. I'll send a corrected invoice this afternoon. Man: Thank you. Our accounting team will wait for the revised invoice before paying.",
    "prompt": "When will the accounting team pay?",
    "options": [
      "Before lunch",
      "After receiving the revised invoice",
      "When the next order arrives",
      "At the end of the month"
    ],
    "answer": 1,
    "audio": "./assets/study/audio/toeic-invoice-correction.wav",
    "evidence": "Our accounting team will wait for the revised invoice before paying.",
    "explanationVi": "Kế toán sẽ chờ nhận hóa đơn đã sửa rồi mới thanh toán.",
    "explanation": "Our accounting team will wait for the revised invoice before paying.",
    "followUp": {
      "prompt": "We’ll wait for the approval before ordering. What must happen first?",
      "options": [
        "Place the order",
        "Get approval"
      ],
      "answer": 1,
      "explanation": "Before cho biết cần được phê duyệt trước."
    }
  }
],
      {
        id: "toeic-l8", exam: "TOEIC Listening & Reading", skill: "Listening", part: "Part 4 · Talks", type: "choice", title: "Staff announcement",
        transcript: "This is a reminder that the staff entrance will be closed from 6 p.m. today while the access system is upgraded. Employees working late should leave through the lobby entrance and return their temporary visitor cards to security. The usual staff entrance will reopen tomorrow at 6 a.m.",
        prompt: "What should employees working late do?", options: ["Use the lobby exit and return their temporary cards.", "Wait in the staff entrance until 6 a.m.", "Keep their visitor card overnight.", "Use the loading dock."], answer: 0,
        explanation: "The announcement directs late staff to use the lobby entrance and return temporary cards to security.",
        audio: "./assets/study/audio/toeic-focus-l8.wav",
        explanationVi: "Nhân viên làm muộn cần ra bằng lối sảnh và trả thẻ tạm cho bảo vệ.",
      },
      {
        "id": "toeic-l8-extra-1",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 4 · Talks",
        "title": "Staff announcement",
        "audio": "./assets/study/audio/toeic-focus-l8.wav",
        "transcript": "This is a reminder that the staff entrance will be closed from 6 p.m. today while the access system is upgraded. Employees working late should leave through the lobby entrance and return their temporary visitor cards to security. The usual staff entrance will reopen tomorrow at 6 a.m.",
        "type": "choice",
        "prompt": "Why is the staff entrance closing?",
        "options": [
          "To replace its lighting",
          "To upgrade the access system",
          "To clean the lobby",
          "To check visitor records"
        ],
        "answer": 1,
        "explanationVi": "Lối vào đóng để nâng cấp hệ thống kiểm soát ra vào.",
        "explanation": "Lối vào đóng để nâng cấp hệ thống kiểm soát ra vào.",
        "evidence": "while the access system is upgraded"
      },
      {
        "id": "toeic-l8-extra-2",
        "exam": "TOEIC Listening & Reading",
        "skill": "Listening",
        "part": "Part 4 · Talks",
        "title": "Staff announcement",
        "audio": "./assets/study/audio/toeic-focus-l8.wav",
        "transcript": "This is a reminder that the staff entrance will be closed from 6 p.m. today while the access system is upgraded. Employees working late should leave through the lobby entrance and return their temporary visitor cards to security. The usual staff entrance will reopen tomorrow at 6 a.m.",
        "type": "choice",
        "prompt": "When will normal access resume?",
        "options": [
          "At 6 this evening",
          "At midnight",
          "Tomorrow at noon",
          "Tomorrow at 6 a.m."
        ],
        "answer": 3,
        "explanationVi": "Lối dành cho nhân viên mở lại vào 6 giờ sáng hôm sau.",
        "explanation": "Lối dành cho nhân viên mở lại vào 6 giờ sáng hôm sau.",
        "evidence": "The usual staff entrance will reopen tomorrow at 6 a.m."
      },
      {
        id: "toeic-r5", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 5 · Incomplete sentences", type: "choice", title: "Grammar in context",
        passage: "Please submit the travel receipts ------- the finance office by Friday.", prompt: "Choose the word that completes the sentence.", options: ["to", "at", "from", "during"], answer: 0,
        explanation: "Submit something to a recipient or destination; the other prepositions do not fit this construction.",
      },
      {
        id: "toeic-r6", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 5 · Incomplete sentences", type: "choice", title: "Grammar in context",
        passage: "The new scheduling software is ------- easier to use than the previous version.", prompt: "Choose the word that completes the sentence.", options: ["consider", "considerably", "consideration", "considerate"], answer: 1,
        explanation: "An adverb is needed to modify the comparative adjective easier; considerably is the correct form.",
      },
      {
        id: "toeic-r7", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 5 · Incomplete sentences", type: "choice", title: "Grammar in context",
        passage: "Ms. Nguyen will lead the inspection ------- the maintenance supervisor is away.", prompt: "Choose the word that completes the sentence.", options: ["while", "unless", "despite", "therefore"], answer: 0,
        explanation: "While introduces the time period during which the supervisor is away.",
      },
      {
        id: "toeic-r8", exam: "TOEIC Listening & Reading", skill: "Reading", part: "Part 5 · Incomplete sentences", type: "choice", title: "Grammar in context",
        passage: "All visitors must wear a badge ------- they are inside the research centre.", prompt: "Choose the word that completes the sentence.", options: ["throughout", "among", "beside", "toward"], answer: 0,
        explanation: "Throughout expresses the entire period visitors are inside the centre.",
      },
      ...IELTS_DIAGNOSTIC_ADDITIONS,
      ...IELTS_BAND_7_PRACTICE_EXERCISES,
      ...IELTS_META_PRACTICE_EXERCISES,
    ].map((item) => {
      const diagnostic = IELTS_DIAGNOSTIC_EXISTING_ITEMS[item.id];
      if (!diagnostic) return item;
      return {
        ...item,
        part: diagnostic.skill === "Reading" ? `Reading · Passage ${diagnostic.section}` : `Listening · Part ${diagnostic.section}`,
        diagnosticSet: IELTS_DIAGNOSTIC_FORM,
        diagnosticOrder: diagnostic.order,
        diagnosticSection: diagnostic.section,
        ...(diagnostic.skill === "Reading"
          ? { passage: IELTS_DIAGNOSTIC_PASSAGES[diagnostic.contextId] }
          : { transcript: IELTS_DIAGNOSTIC_SCRIPTS[diagnostic.contextId] }),
      };
    }),
    writingPrompts: [
      { id: "ia-w1", exam: "IELTS Academic · Task 2", skill: "Writing", task: "Task 2 · Opinion", pathwayStage: "band-5", focus: "State a clear position, then develop it with one reason and a relevant example.", methodCue: "Write the core claim as a simple subject–verb sentence first; add the reason and example after it.", suggestedMinutes: 40, minimumWords: 250, prompt: "Some people believe cities should invest more in public transport than in new roads. To what extent do you agree or disagree? Give reasons and examples." },
      { id: "ia-w2", exam: "IELTS Academic · Task 1", skill: "Writing", task: "Task 1 · Table", pathwayStage: "band-5", focus: "Choose the largest changes for the overview before comparing individual figures.", methodCue: "Name the main trend in one overview sentence; compare the figures in short sentences built around a clear subject and verb.", suggestedMinutes: 20, minimumWords: 150, prompt: "The table shows the percentage of commuters using each mode of transport in Northport in 2010 and 2020. Bus: 42% and 35%; car: 38% and 31%; bicycle: 8% and 19%; walking: 12% and 15%. Summarise the main features and make relevant comparisons." },
      { id: "ia-w3", exam: "IELTS Academic · Task 1", skill: "Writing", task: "Task 1 · Process", pathwayStage: "band-6", focus: "Group the stages into a clear sequence and include a process overview.", methodCue: "Put the process subject and main action in each sentence first; add sequence or condition details around that sentence spine.", image: "./assets/study/ielts-compost-process.svg", imageAlt: "Five-step diagram: collect food scraps, sort and chop, mix with leaves and water, aerate for six weeks, then screen and use the compost.", suggestedMinutes: 20, minimumWords: 150, prompt: "The diagram shows how household food waste is turned into compost. Describe the stages, from collection to the finished product. Include an overview of the process." },
      { id: "ia-w4", exam: "IELTS Academic · Task 2", skill: "Writing", task: "Task 2 · Discussion", pathwayStage: "band-6", focus: "Explain both positions fairly and make your own view clear throughout.", methodCue: "Build one sentence for each view; use a while-contrast frame, then state your position and support it with a reason.", suggestedMinutes: 40, minimumWords: 250, prompt: "Some people think universities should focus on job-related skills, while others believe they should provide a broader education. Discuss both views and give your opinion." },
      { id: "ia-w5", exam: "IELTS Academic · Task 1", skill: "Writing", task: "Task 1 · Line graph", pathwayStage: "band-6", focus: "Summarise the overall direction, identify turning points and compare the series accurately.", methodCue: "Write the overall trend first; then describe each line with a subject–verb spine and add the years and figures that prove the comparison.", image: "./assets/study/ielts-transport-line-graph.svg", imageAlt: "Line graph of weekly travel choices among Northport University first-year students from 2018 to 2023: shuttle bus rises, cycling rises then dips, and walking declines.", suggestedMinutes: 20, minimumWords: 150, prompt: "The line graph shows the percentage of first-year students using three ways to travel to Northport University each week from 2018 to 2023. Summarise the main features and make relevant comparisons." },
      { id: "ia-w6", exam: "IELTS Academic · Task 2", skill: "Writing", task: "Task 2 · Causes and solutions", pathwayStage: "band-6", focus: "Answer both parts and keep each proposed solution connected to a stated cause.", methodCue: "Give each paragraph one main idea; build its core sentence first, then explain the cause or show how the solution responds to it.", suggestedMinutes: 40, minimumWords: 250, prompt: "In many cities, people spend a long time travelling between home and work. What are the main causes of this problem, and what measures could governments and employers take to address it?" },
      { id: "ia-w7", exam: "IELTS Academic · Task 1", skill: "Writing", task: "Task 1 · Maps", pathwayStage: "band-6-5", focus: "Select the major changes and compare the site's layout at two points in time.", methodCue: "Make each sentence about one place or feature; put the location and change in the main clause, then add time or direction details.", image: "./assets/study/ielts-campus-maps.svg", imageAlt: "Two maps compare Northport University's riverside campus in 2005 and 2025, showing a residence, expanded library, new riverside walkway and cafe, and an unchanged southern path.", suggestedMinutes: 20, minimumWords: 150, prompt: "The maps show changes to the riverside campus of Northport University between 2005 and 2025. Summarise the main changes and compare the two maps." },
      { id: "ia-w8", exam: "IELTS Academic · Task 2", skill: "Writing", task: "Task 2 · Advantages and disadvantages", pathwayStage: "band-6-5", focus: "Evaluate both sides and make the ‘outweigh’ judgement explicit.", methodCue: "State your judgement in a direct sentence; develop each advantage or drawback from its core claim, then connect it to a consequence.", suggestedMinutes: 40, minimumWords: 250, prompt: "Many universities now deliver most lectures online rather than in large lecture halls. Do the advantages of this change outweigh the disadvantages? Give reasons and examples." },
      ...IELTS_BAND_7_WRITING_PROMPTS,
      ...IELTS_META_WRITING_PROMPTS,
    ],
    speakingPrompts: [
      { id: "ia-s1", exam: "IELTS Academic · Part 1", skill: "Speaking", task: "Part 1 · Familiar topics", pathwayStage: "band-5", focus: "Answer each personal question directly, then add a reason or one detail.", methodCue: "Use a short answer first; continue with one reason and a concrete example or detail, in spoken chunks.", prompt: "What do you enjoy most about the place where you live? Has it changed much in recent years?" },
      { id: "ia-s2", exam: "IELTS Academic · Part 2", skill: "Speaking", task: "Part 2 · Cue card", pathwayStage: "band-5", focus: "Build a chronological long turn from a small set of cue words.", methodCue: "Use the one-minute preparation to note who → when → what happened → why it mattered; speak for up to two minutes in practiced chunks.", prompt: "Describe a useful piece of advice you received. Say who gave it, when you received it, what the advice was, and explain why it was useful." },
      { id: "ia-s3", exam: "IELTS Academic · Part 3", skill: "Speaking", task: "Part 3 · Discussion", pathwayStage: "band-6", focus: "Compare benefits and drawbacks for more than one group.", methodCue: "Start with a measured view, give a reason, and add a consequence for workers or communities.", prompt: "Some people think employers should allow staff to work from home whenever possible. What are the main benefits and drawbacks for workers and communities?" },
      { id: "ia-s4", exam: "IELTS Academic · Part 3", skill: "Speaking", task: "Part 3 · Discussion", pathwayStage: "band-6", focus: "Move from a direct proposal to a reason and practical example.", methodCue: "Answer the policy question first; add why it may work and one concrete example before you finish.", prompt: "How can cities encourage people to use public transport, and what role should local governments play in reducing traffic?" },
      { id: "ia-s5", exam: "IELTS Academic · Part 1", skill: "Speaking", task: "Part 1 · Study", pathwayStage: "band-6", focus: "Extend a familiar answer without turning it into a memorised speech.", methodCue: "Answer first, then add one reason and a short example; use a natural phrase to connect the chunks.", prompt: "Do you prefer studying alone or with other people? What helps you stay focused when you study?" },
      { id: "ia-s6", exam: "IELTS Academic · Part 2", skill: "Speaking", task: "Part 2 · Cue card", pathwayStage: "band-6", focus: "Keep the long turn coherent by moving through time and explaining why the change mattered.", methodCue: "Prepare four or five keywords in order; start with the place, move through the change, and end with its effect on people.", prompt: "Describe a place in your area that has changed in a positive way. Say where it is, what it was like before, what changed, and explain why the change was positive." },
      { id: "ia-s7", exam: "IELTS Academic · Part 3", skill: "Speaking", task: "Part 3 · Evaluating policy", pathwayStage: "band-6-5", focus: "Weigh short-term costs against long-term public benefits and qualify your view.", methodCue: "State a qualified position → give a reason → acknowledge a trade-off → support the conclusion with a social example.", prompt: "Some cities are considering spending more on shade and green spaces, even when this means delaying other construction projects. How should local governments decide whether this investment is worthwhile?" },
      { id: "ia-s8", exam: "IELTS Academic · Part 3", skill: "Speaking", task: "Part 3 · Evidence and society", pathwayStage: "band-6-5", focus: "Develop a balanced argument about public evidence, privacy and trust.", methodCue: "Use a measured claim, explain the benefit, recognise a concern, then give an example of a reasonable safeguard.", prompt: "Should researchers make the data they collect about communities available to the public? What benefits and risks might this create?" },
      ...IELTS_BAND_7_SPEAKING_PROMPTS,
      ...IELTS_META_SPEAKING_PROMPTS,
    ],
  },
];

export function validateStudyContentPacks(packs = STUDY_CONTENT_PACKS) {
  const issues = [];
  const ids = new Set();
  for (const pack of packs) {
    if (!pack || pack.schemaVersion !== STUDY_CONTENT_SCHEMA_VERSION) {
      issues.push("Unsupported content pack schema version.");
      continue;
    }
    if (!pack.id || !pack.version || !pack.author || !pack.license || !pack.offline)
      issues.push("A pack is missing identity, version, authorship, license or offline metadata.");
    for (const item of [...(pack.exercises || []), ...(pack.writingPrompts || []), ...(pack.speakingPrompts || [])]) {
      if (!item.id || !/^[a-z0-9][a-z0-9-]*$/i.test(item.id) || ids.has(item.id)) issues.push(`Missing, malformed or duplicate content id: ${item.id || "(empty)"}`);
      ids.add(item.id);
      if (!item.exam || !item.skill && !item.task || !item.prompt) issues.push(`Incomplete content item: ${item.id}`);
      if (item.exam === "IELTS Academic" || item.exam.startsWith("IELTS Academic ·")) {
        if (!IELTS_PATHWAY_STAGES.some((stage) => stage.id === item.pathwayStage)) issues.push(`IELTS item is missing a valid pathway stage: ${item.id}`);
        if (typeof item.focus !== "string" || !item.focus.trim()) issues.push(`IELTS item is missing a skill focus: ${item.id}`);
      }
      if (item.type && !item.explanation) issues.push(`Missing objective explanation: ${item.id}`);
      if (item.image && (typeof item.image !== "string" || !item.image.startsWith("./assets/study/") || typeof item.imageAlt !== "string" || !item.imageAlt.trim())) issues.push(`Study visual has an invalid offline path or missing alt text: ${item.id}`);
      if (["choice", "audio-choice"].includes(item.type) && (!Array.isArray(item.options) || item.options.length < 2 || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)) issues.push(`Invalid choice answer key: ${item.id}`);
      if (item.type === "short-answer" && (!Array.isArray(item.acceptedAnswers) || !item.acceptedAnswers.length || item.acceptedAnswers.some((a) => typeof a !== "string" || !a.trim()))) issues.push(`Missing or invalid accepted answers: ${item.id}`);
      if (item.type === "gap-fill" && (!item.gaps?.length || item.gaps.some((g) => !g.id || !g.label || !Array.isArray(g.acceptedAnswers) || !g.acceptedAnswers.length))) issues.push(`Gap-fill has invalid answer definitions: ${item.id}`);
      if (item.type === "matching" && (!item.pairs?.length || item.pairs.some((pair) => !pair.id || !pair.label || !pair.answer))) issues.push(`Matching item has invalid pairs: ${item.id}`);
      if (item.type === "audio-choice" && (!Array.isArray(item.audioChoices) || item.audioChoices.length !== item.options?.length || item.audioChoices.some((src) => typeof src !== "string" || !src.startsWith("./assets/study/audio/")))) issues.push(`Invalid offline audio choices: ${item.id}`);
      if (item.type && !["choice", "audio-choice", "short-answer", "gap-fill", "matching"].includes(item.type)) issues.push(`Unknown question type: ${item.id}`);
    }
    for (const exam of pack.exams || []) {
      const covered = new Set([...pack.exercises, ...pack.writingPrompts, ...pack.speakingPrompts].filter((x) => x.exam === exam.title || x.exam.startsWith(`${exam.title} ·`)).map((x) => x.skill));
      for (const skill of exam.skills) if (!covered.has(skill)) issues.push(`${exam.title} is missing ${skill} content.`);
    }
    for (const stage of IELTS_PATHWAY_STAGES) {
      const stageSkills = new Set([...pack.exercises, ...pack.writingPrompts, ...pack.speakingPrompts]
        .filter((x) => x.pathwayStage === stage.id && (x.exam === "IELTS Academic" || x.exam.startsWith("IELTS Academic ·")))
        .map((x) => x.skill));
      for (const skill of ["Listening", "Reading", "Writing", "Speaking"])
        if (!stageSkills.has(skill)) issues.push(`IELTS ${stage.label} is missing ${skill} practice.`);
    }
    const toeic = pack.exercises.filter((x) => x.exam === "TOEIC Listening & Reading").map((x) => x.part || "").join(" ");
    for (let part = 1; part <= 7; part++) if (!new RegExp(`Part ${part} ·`).test(toeic)) issues.push(`TOEIC starter content is missing Part ${part}.`);
    if (!pack.exercises.some((x) => x.exam === "TOEIC Listening & Reading" && x.part.startsWith("Part 1 ·") && x.type === "audio-choice")) issues.push("TOEIC Part 1 must include bundled offline audio.");
  }
  return { valid: issues.length === 0, issues, count: ids.size };
}

export function getStudyExercises(exam, pathwayStage = null) {
  return STUDY_CONTENT_PACKS.flatMap((pack) => pack.exercises).filter((item) =>
    item.exam === exam && (!pathwayStage || item.pathwayStage === pathwayStage),
  );
}
export function getStudyPrompts(kind, pathwayStage = null) {
  return STUDY_CONTENT_PACKS.flatMap((pack) => pack[`${kind}Prompts`] || []).filter((item) =>
    !pathwayStage || item.pathwayStage === pathwayStage,
  );
}
export function getIELTSPathwayStage(id) {
  return IELTS_PATHWAY_STAGES.find((stage) => stage.id === id) || IELTS_PATHWAY_STAGES[0];
}

export const STUDY_EXAM_CONFIG = {
  "IELTS Academic": { mockMinutes: 20 },
  "TOEIC Listening & Reading": { mockMinutes: 15 },
};
