import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

const page = document.body.dataset.page || "home";

const CONTENT_STORE_KEY = "bhf_admin_content";
const ENROLLMENT_STORE_KEY = "bhf_user_enrollments";
const ADMIN_EMAIL = "admin@bhf.com";

/* =============================================
   Firebase Authentication (replaces old localStorage
   "bhf_user_database" / "bhf_auth" fake accounts)
============================================= */
let currentUser = null; // { uid, email, name, role }
let resolveAuthReady;
const authReadyPromise = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    const email = (user.email || "").toLowerCase();
    currentUser = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || (email === ADMIN_EMAIL ? "Admin" : email.split("@")[0]),
      role: email === ADMIN_EMAIL ? "admin" : "user"
    };
  } else {
    currentUser = null;
  }
  resolveAuthReady();
  updateHeaderAuthLink();
});

/* =============================================
   Firestore-backed course catalog (replaces old
   localStorage "bhf_course_catalog")
============================================= */
let coursesCache = [];

const loadCoursesCache = async () => {
  try {
    const snapshot = await getDocs(collection(db, "courses"));
    coursesCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("Failed to load courses from Firestore", error);
    coursesCache = [];
  }
};

const normalizeCourseTitle = (title) => {
  return (title || "").trim().toLowerCase();
};

// Synchronous read from the in-memory cache that loadCoursesCache() fills
// from Firestore on startup. Kept synchronous so all the existing render
// functions below don't need to change.
const getSavedCourses = () => coursesCache;

const findSavedCourse = (title) => {
  const normalized = normalizeCourseTitle(title);
  return coursesCache.find((course) => normalizeCourseTitle(course.title) === normalized) || null;
};

const updateSavedCourse = async (title, updates) => {
  const normalized = normalizeCourseTitle(title);
  const existing = coursesCache.find((item) => normalizeCourseTitle(item.title) === normalized);
  if (!existing) return null;
  await updateDoc(doc(db, "courses", existing.id), updates);
  await loadCoursesCache();
  return findSavedCourse(title);
};

const removeSavedCourse = async (title) => {
  const normalized = normalizeCourseTitle(title);
  const existing = coursesCache.find((item) => normalizeCourseTitle(item.title) === normalized);
  if (existing) {
    await deleteDoc(doc(db, "courses", existing.id));
    await loadCoursesCache();
  }
  return coursesCache;
};

const addSavedCourse = async (course) => {
  const normalized = normalizeCourseTitle(course.title);
  const existing = coursesCache.find((item) => normalizeCourseTitle(item.title) === normalized);
  if (existing) {
    await updateDoc(doc(db, "courses", existing.id), course);
  } else {
    await addDoc(collection(db, "courses"), course);
  }
  await loadCoursesCache();
  return course;
};

const getCourseCatalog = () => {
  const saved = getSavedCourses();
  const savedMap = saved.reduce((map, course) => {
    map[normalizeCourseTitle(course.title)] = course;
    return map;
  }, {});

  const base = typeof BHF_COURSES !== "undefined"
    ? BHF_COURSES.map((course) => savedMap[normalizeCourseTitle(course.title)] || course)
    : [];

  const extra = saved.filter(
    (course) => !base.some((baseCourse) => normalizeCourseTitle(baseCourse.title) === normalizeCourseTitle(course.title))
  );

  return [...base, ...extra];
};

const getEnrollments = () => {
  const stored = localStorage.getItem(ENROLLMENT_STORE_KEY);
  try {
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveEnrollments = (enrollments) => {
  localStorage.setItem(ENROLLMENT_STORE_KEY, JSON.stringify(enrollments));
};

const mergeCoursesWithSaved = (defaultCourses) => {
  const savedCourses = getSavedCourses();
  const normalizedSaved = savedCourses.reduce((map, course) => {
    map[normalizeCourseTitle(course.title)] = course;
    return map;
  }, {});

  const merged = defaultCourses.map((course) => {
    const saved = normalizedSaved[normalizeCourseTitle(course.title)];
    return saved ? { ...course, ...saved } : course;
  });

  const extraSaved = savedCourses.filter(
    (course) => !merged.some((item) => normalizeCourseTitle(item.title) === normalizeCourseTitle(course.title))
  );

  return [...merged, ...extraSaved];
};

/* =============================================
   BHF Course Catalog (defined early for page logic)
   Edit titles, descriptions, and images here —
   both programs.html and course-detail.html read
   from this single list.
============================================= */
const BHF_COURSES = [
  // ---------- Hospitality Management ----------
  { title: "Hospitality Management Fundamentals", category: "Hospitality Management",
    desc: "Learn the core concepts of hotel and resort operations, guest relations, and industry standards.",
    img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
    learning: [
      "Master hospitality industry structure and key business models",
      "Understand guest journey mapping and service cycles",
      "Learn quality standards and customer satisfaction metrics",
      "Develop leadership skills for hospitality teams",
      "Understand revenue management and profitability drivers"
    ]
  },
	  { title: "Front Office Operations", category: "Hospitality Management",
	    desc: "Master check-in/check-out procedures, reservation systems, billing, and guest service management.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRC3m27M10uOmuQWed1J1naNQjdkR8tymm--TT_y23RWg&s=10",
	    learning: [
        "Operate modern property management systems (PMS)",
        "Execute flawless check-in and check-out procedures",
        "Manage reservations, modifications, and cancellations",
        "Handle guest complaints and special requests professionally",
        "Perform accurate billing and financial reconciliation"
      ]
	  },
	  { title: "Food & Beverage Service Management", category: "Hospitality Management",
	    desc: "Understand restaurant operations, menu planning, table service, and quality control.",
	    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Plan menus and manage food costs and inventory",
        "Master table service standards and etiquette",
        "Develop wine and beverage pairing knowledge",
        "Implement food safety and hygiene protocols",
        "Manage F&B operations profitably and efficiently"
      ]
	  },
	  { title: "Housekeeping & Accommodation Management", category: "Hospitality Management",
	    desc: "Learn room maintenance, sanitation standards, linen management, and facility safety protocols.",
	    img: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Maintain international housekeeping standards and cleanliness",
        "Manage linen and laundry operations efficiently",
        "Implement preventive maintenance schedules",
        "Train and supervise housekeeping teams effectively",
        "Ensure guest room safety and quality assurance"
      ]
	  },
	  { title: "Tourism & Travel Services", category: "Hospitality Management",
	    desc: "Study tour planning, destination management, ticketing, and customer service in the travel industry.",
	    img: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Plan and execute memorable tour itineraries",
        "Master ticketing systems and travel logistics",
        "Understand visa, documentation, and travel regulations",
        "Manage destination knowledge and local partnerships",
        "Deliver exceptional customer experiences in travel services"
      ]
	  },

  // ---------- Accounting & Finance ----------
  { title: "Basic Bookkeeping & Accounting", category: "Accounting & Finance",
    desc: "Learn double-entry bookkeeping, recording transactions, and preparing basic financial statements.",
    img: "https://images.unsplash.com/photo-1554224311-beee415c201f?auto=format&fit=crop&w=600&q=80",
    learning: [
      "Master double-entry bookkeeping principles and mechanics",
      "Classify and record various business transactions accurately",
      "Understand general ledger, journals, and trial balance",
      "Prepare basic financial statements (income statement, balance sheet)",
      "Apply fundamental accounting concepts and conventions"
    ]
  },
	  { title: "Financial Reporting & Analysis", category: "Accounting & Finance",
	    desc: "Understand how to prepare, interpret, and analyze financial reports for business decision-making.",
	    img: "https://images.unsplash.com/photo-1535604142269-dcb2c4e47854?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Prepare comprehensive financial statements (GAAP compliant)",
        "Analyze financial ratios and performance metrics",
        "Interpret cash flow statements and working capital",
        "Conduct horizontal and vertical financial analysis",
        "Use financial data to support business decision-making"
      ]
	  },
	  { title: "Taxation & Business Compliance", category: "Accounting & Finance",
	    desc: "Get familiar with local tax laws, filing requirements, payroll accounting, and government regulations.",
	    img: "https://images.unsplash.com/photo-1460925895917-adf4e565db12?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Navigate complex tax laws and filing requirements",
        "Calculate and manage payroll withholdings and compliance",
        "Understand different business entity tax implications",
        "Prepare tax returns and maintain compliance documentation",
        "Stay current with changing regulations and amendments"
      ]
	  },
	  { title: "Accounting Software Applications", category: "Accounting & Finance",
	    desc: "Hands-on training in QuickBooks, Xero, and other tools used to manage business finances.",
	    img: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Operate QuickBooks and Xero with proficiency",
        "Set up chart of accounts and company files",
        "Automate invoicing, expenses, and payroll workflows",
        "Generate custom reports and financial dashboards",
        "Integrate accounting software with other business systems"
      ]
	  },
	  { title: "Cost Accounting & Budgeting", category: "Accounting & Finance",
	    desc: "Learn to calculate production costs, prepare budgets, and control expenses for profitability.",
	    img: "https://images.unsplash.com/photo-1631634542175-112a4c60e11c?auto=format&fit=crop&w=600&q=80",
	    learning: [
        "Calculate and analyze direct and indirect production costs",
        "Prepare comprehensive budgets across all departments",
        "Monitor budget variances and implement corrective actions",
        "Understand cost-benefit analysis and profitability management",
        "Use cost data for strategic pricing and product decisions"
      ]
	  },

  // ---------- Information Technology ----------
  { title: "Computer Systems Servicing", category: "Information Technology",
    desc: "Learn to assemble, install, configure, and maintain computer hardware and software systems.",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkH9RNW3uxuz41bMj7bQQWymRW3ZcwQr2yevEZKCau2A&s=10",
    learning: [
      "Assemble and configure computer hardware components",
      "Install and configure operating systems and drivers",
      "Troubleshoot hardware and software problems systematically",
      "Perform maintenance and preventive care on systems",
      "Diagnose and resolve performance and connectivity issues"
    ]
  },
	  { title: "Office Productivity Applications", category: "Information Technology",
	    desc: "Master Microsoft Office and Google Workspace to improve efficiency in daily business tasks.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTh0iqJLPHlVmw-Gfwb5dA8AW9MYeN8TS1jsUim9FFRZA&s=10",
	    learning: [
        "Use Word, Excel, and PowerPoint at advanced levels",
        "Master data analysis and pivot tables in Excel",
        "Create professional presentations with animations",
        "Collaborate using Google Workspace and OneDrive",
        "Automate tasks using macros and formulas"
      ]
	  },
	  { title: "Web Design & Development", category: "Information Technology",
	    desc: "Learn HTML, CSS, and JavaScript to build functional, responsive, and user-friendly websites.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNCQ8z0aEXoHaDzam79rccBTG_K48YjSjhofORheyeFQ&s=10",
	    learning: [
        "Build semantic and accessible HTML structures",
        "Master CSS for responsive and adaptive design",
        "Use JavaScript for interactive user experiences",
        "Optimize websites for performance and SEO",
        "Deploy and maintain websites on web servers"
      ]
	  },
	  { title: "Computer Networking & Security", category: "Information Technology",
	    desc: "Understand network setup, connectivity, basic security, and troubleshooting for small businesses.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQBXyIcNm3_hmpkOgq4njhL5gOvr7y07zAI2mKiW_nGg&s=10",
	    learning: [
        "Design and configure local area networks (LANs)",
        "Implement network security protocols and firewalls",
        "Manage user access and authentication systems",
        "Monitor network performance and troubleshoot connectivity",
        "Establish data backup and disaster recovery plans"
      ]
	  },
	  { title: "Digital Literacy & Online Safety", category: "Information Technology",
	    desc: "Learn how to use technology safely, manage data, and protect information online.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSx94ap5PbwVfQa6ovF5k3ZiFH4b_bNe1NeLQvjqXXklQ&s=10",
	    learning: [
        "Recognize and avoid phishing scams and social engineering",
        "Manage strong passwords and digital identity",
        "Understand privacy settings and data protection laws",
        "Use secure communication and file sharing methods",
        "Stay safe on social media and when shopping online"
      ]
	  },

  // ---------- Business & Management ----------
  { title: "Business Administration", category: "Business & Management",
    desc: "Learn organizational structure, operations planning, and management principles for daily business.",
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
    learning: [
      "Understand organizational structures and departmental functions",
      "Develop operational plans and efficiency improvements",
      "Master administrative procedures and documentation",
      "Coordinate cross-functional team activities effectively",
      "Implement systems and processes for smooth operations"
    ]
  },
	  { title: "Entrepreneurship & Business Planning", category: "Business & Management",
	    desc: "Develop business ideas, write a business plan, and learn how to start and manage your own enterprise.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6mCnpBgGSqU-1FFq0xVUDHyBD9_Yb2Zpfin4Izfymow&s=10",
	    learning: [
        "Validate business ideas and conduct market research",
        "Write comprehensive business plans and financial projections",
        "Secure funding and manage startup capital",
        "Navigate legal and regulatory requirements for new businesses",
        "Scale operations while maintaining quality and profitability"
      ]
	  },
	  { title: "Human Resource Management", category: "Business & Management",
	    desc: "Study recruitment, employee relations, training, performance evaluation, and labor laws.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4T9gR26TGBtBTepL67heMdTi0JxkufbPVMBV54DoEtw&s=10",
	    learning: [
        "Recruit, screen, and hire qualified candidates effectively",
        "Develop employee training and development programs",
        "Conduct fair performance reviews and evaluations",
        "Manage compensation, benefits, and employee relations",
        "Ensure compliance with employment laws and regulations"
      ]
	  },
	  { title: "Marketing & Sales Strategy", category: "Business & Management",
	    desc: "Learn market research, branding, advertising, and techniques to attract and retain customers.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiFNIAgSRC77glHFuqTt09e5XKb3vfpVfp08kTol1Abw&s=10",
	    learning: [
        "Conduct market research and competitive analysis",
        "Develop brand strategy and positioning",
        "Create integrated marketing campaigns across channels",
        "Master sales techniques and customer relationship management",
        "Measure marketing ROI and optimize campaigns"
      ]
	  },
	  { title: "Leadership & Workplace Supervision", category: "Business & Management",
	    desc: "Develop skills to lead teams, solve problems, and improve productivity in the workplace.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhAeZFXJUr4kCKW4LmThjiJARlA6OaHl_thSE3TUbubw&s=10",
	    learning: [
        "Develop authentic leadership presence and credibility",
        "Motivate teams and build high-performing cultures",
        "Resolve conflicts and manage difficult conversations",
        "Delegate effectively and empower team members",
        "Drive performance improvements and accountability"
      ]
	  },

  // ---------- Professional Skills ----------
  { title: "Customer Service Excellence", category: "Professional Skills",
    desc: "Build communication and conflict resolution skills to deliver high-quality service to clients.",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqFJGIIZ9FMZW2WyLQSq8fSgP7xFHnnM7dtqDZKOrH4g&s=10",
    learning: [
      "Listen actively and empathize with customer needs",
      "Resolve complaints and turn dissatisfied customers into advocates",
      "Communicate professionally and courteously in all interactions",
      "Manage difficult situations and emotional customers calmly",
      "Exceed expectations and build lasting customer relationships"
    ]
  },
	  { title: "Occupational Health & Safety", category: "Professional Skills",
	    desc: "Learn safety standards, risk management, and emergency procedures to maintain a safe workplace.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdy-N0ttsKw24w3je0B-E4u0Qhw9geQEbM9jv1_qWa-g&s=10",
	    learning: [
        "Identify workplace hazards and assess risk levels",
        "Implement safety protocols and emergency procedures",
        "Investigate incidents and prevent recurrence",
        "Train employees on safety practices and protocols",
        "Maintain compliance with OSHA and regulatory standards"
      ]
	  },
	  { title: "Business Communication & Etiquette", category: "Professional Skills",
	    desc: "Improve written and verbal communication, professional correspondence, and workplace manners.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYqZhThyo_G8Eb1bxNq2AkRgO6BFCoSVho-XBrXboROg&s=10",
	    learning: [
        "Write clear and professional emails and reports",
        "Deliver engaging presentations and public speaking",
        "Practice proper business etiquette and cultural sensitivity",
        "Navigate difficult conversations diplomatically",
        "Build professional credibility through communication excellence"
      ]
	  },
	  { title: "Time & Task Management", category: "Professional Skills",
	    desc: "Learn how to organize work, set priorities, and improve personal and team productivity.",
	    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9R5SjtfCD2FooHtOLnFy-ugsFy933urncXu5tMw2mMA&s=10",
	    learning: [
        "Use proven time management systems and tools",
        "Prioritize tasks and manage competing demands",
        "Reduce procrastination and increase productivity",
        "Organize workflows and eliminate time wasters",
        "Balance work and personal life effectively"
      ]
	  }
];

/* =============================================
   Generic placeholder lesson modules per course.
   Each module now includes detailed content and
   5 quiz questions at the end with a check answers feature.
============================================= */
function getModulesFor(courseTitle) {
  return [
    {
      title: "Module 1: Introduction & Overview",
      content: `<h3>Welcome to ${courseTitle}</h3>
      <p>This foundational module introduces the key concepts, terminology, and real-world context essential to understanding ${courseTitle}. You will explore the fundamental principles, industry standards, and best practices that form the backbone of this discipline.</p>
      
      <h4>Key Learning Objectives:</h4>
      <ul>
        <li>Understand the core definitions and terminology used in ${courseTitle}</li>
        <li>Learn the historical context and evolution of this field</li>
        <li>Identify key industry standards and regulatory requirements</li>
        <li>Explore career opportunities and professional pathways</li>
        <li>Establish a foundation for advanced learning in subsequent modules</li>
      </ul>
      
      <h4>What You'll Learn:</h4>
      <p>In this module, we will cover the essential background knowledge you need. You'll discover why this subject matters in today's professional landscape, how it integrates with other business functions, and what role you'll play in your organization. Real-world examples and case studies will illustrate how these concepts apply in practice.</p>
      
      <h4>Specific Skills & Knowledge You'll Gain:</h4>
      <ul>
        <li>Master essential terminology and industry-specific vocabulary used by professionals</li>
        <li>Understand the historical development and evolution of the field</li>
        <li>Recognize key stakeholders and their roles in the industry</li>
        <li>Identify major trends and opportunities in the market</li>
        <li>Comprehend basic processes and workflows in this domain</li>
        <li>Discover educational paths and career progression opportunities</li>
        <li>Learn fundamental business drivers and success metrics</li>
        <li>Understand the value proposition and impact on organizations</li>
      </ul>
      
      <p>This module sets the stage for deeper exploration. By the end, you should be able to articulate the core principles, understand key terminology, and see how everything connects to create a cohesive framework for success.</p>`,
      quiz: [
        { q: "What is the primary purpose of studying ${courseTitle}?", options: ["A) To pass time", "B) To develop professional competency and excel in your role", "C) To memorize facts", "D) None of the above"], answer: 1 },
        { q: "Which of the following is a key industry standard mentioned in this module?", options: ["A) Personal preferences only", "B) Established regulatory requirements and best practices", "C) Random guidelines", "D) Optional recommendations"], answer: 1 },
        { q: "What does terminology refer to in the context of this course?", options: ["A) Random words", "B) The specialized language and key terms used in this field", "C) Only technical jargon", "D) Words to ignore"], answer: 1 },
        { q: "How does this module prepare you for advanced learning?", options: ["A) It doesn't", "B) By establishing foundational knowledge and key concepts", "C) By testing your memory", "D) By providing all answers"], answer: 1 },
        { q: "What real-world application will this knowledge have in your career?", options: ["A) Limited use", "B) Direct application in professional roles and decision-making", "C) Theoretical only", "D) No practical use"], answer: 1 }
      ]
    },
    {
      title: "Module 2: Core Principles & Best Practices",
      content: `<h3>Core Principles of ${courseTitle}</h3>
      <p>This module dives deep into the fundamental principles and best practices that guide ${courseTitle}. Understanding these principles is crucial for making sound decisions and achieving professional excellence in your role.</p>
      
      <h4>Fundamental Principles:</h4>
      <ul>
        <li><strong>Principle 1: Quality & Excellence</strong> - Maintaining high standards in all activities and deliverables</li>
        <li><strong>Principle 2: Integrity & Ethics</strong> - Acting with honesty, transparency, and moral responsibility</li>
        <li><strong>Principle 3: Customer-Centricity</strong> - Prioritizing customer/stakeholder needs and satisfaction</li>
        <li><strong>Principle 4: Continuous Improvement</strong> - Regularly evaluating and enhancing processes and outcomes</li>
        <li><strong>Principle 5: Collaboration & Communication</strong> - Working effectively with others through clear communication</li>
      </ul>
      
      <h4>Best Practices Framework:</h4>
      <p>Professional best practices emerge from decades of industry experience. They represent proven methods that consistently deliver superior results. In ${courseTitle}, these practices are organized around key operational areas: planning, execution, monitoring, and optimization.</p>
      
      <h4>What You'll Learn:</h4>
      <ul>
        <li>Apply the five core principles to daily professional activities and decision-making</li>
        <li>Distinguish between effective and ineffective approaches in common scenarios</li>
        <li>Develop a personal code of professional conduct based on industry ethics</li>
        <li>Implement quality assurance methods and performance standards</li>
        <li>Create systems for continuous feedback and ongoing improvement</li>
        <li>Strengthen interpersonal and communication skills for better collaboration</li>
        <li>Build customer-focused mindsets and practices in your work</li>
        <li>Evaluate and adopt best practices relevant to your role and organization</li>
        <li>Recognize when principles are being compromised and take corrective action</li>
        <li>Mentor others on best practices and professional standards</li>
      </ul>
      
      <p>By adhering to these principles and practices, professionals can minimize risks, maximize efficiency, and build strong relationships with colleagues and stakeholders. Success in your field depends on internalizing these values and applying them consistently in your daily work.</p>`,
      quiz: [
        { q: "Which principle emphasizes meeting stakeholder requirements?", options: ["A) Integrity & Ethics", "B) Customer-Centricity", "C) Quality & Excellence", "D) Collaboration"], answer: 1 },
        { q: "What is the purpose of following best practices in ${courseTitle}?", options: ["A) To follow rules blindly", "B) To deliver consistent, superior results and minimize risks", "C) To complicate work", "D) To save time only"], answer: 1 },
        { q: "How do best practices typically develop?", options: ["A) Randomly", "B) From decades of industry experience and proven methods", "C) From individual preferences", "D) From theoretical models only"], answer: 1 },
        { q: "Why is continuous improvement important in this field?", options: ["A) It's not important", "B) To keep up with industry evolution and enhance effectiveness", "C) To confuse competitors", "D) To reduce accountability"], answer: 1 },
        { q: "What role does communication play in professional success?", options: ["A) No role", "B) Limited role", "C) Essential for effective collaboration and achieving goals", "D) Only for management"], answer: 2 }
      ]
    },
    {
      title: "Module 3: Practical Application & Case Studies",
      content: `<h3>Applying ${courseTitle} in Real-World Scenarios</h3>
      <p>Theory becomes valuable only when applied effectively. This module transitions from concepts to practice, showing you how to implement ${courseTitle} principles in actual work situations.</p>
      
      <h4>Practical Applications:</h4>
      <ul>
        <li>Scenario 1: Managing typical workplace situations using core principles</li>
        <li>Scenario 2: Solving problems with proven methodologies</li>
        <li>Scenario 3: Adapting practices to unique organizational contexts</li>
        <li>Scenario 4: Handling challenges and obstacles effectively</li>
        <li>Scenario 5: Measuring success and demonstrating value</li>
      </ul>
      
      <h4>Case Study Analysis:</h4>
      <p>Real organizations have successfully implemented ${courseTitle} practices to achieve remarkable results. By studying these case studies, you'll see:</p>
      <ul>
        <li>How companies identified problems or opportunities</li>
        <li>Which strategies and tactics they employed</li>
        <li>What results and outcomes they achieved</li>
        <li>What lessons can be applied to your own work</li>
      </ul>
      
      <h4>What You'll Learn:</h4>
      <ul>
        <li>Translate theoretical concepts into practical, actionable steps</li>
        <li>Analyze business problems and develop solution strategies</li>
        <li>Customize best practices to fit your organization's unique needs</li>
        <li>Implement solutions effectively while managing risks and resistance</li>
        <li>Create measurable success metrics and track progress</li>
        <li>Document lessons learned and build organizational knowledge</li>
        <li>Present findings and recommendations to stakeholders</li>
        <li>Adapt strategies based on feedback and changing circumstances</li>
        <li>Leverage technology and tools to enhance practical implementation</li>
        <li>Build business cases and demonstrate ROI for initiatives</li>
      </ul>
      
      <p>These practical examples demonstrate that the concepts you're learning aren't theoretical — they work in real business environments. As you progress in your career, you'll face situations similar to these cases. This module prepares you to recognize them and apply appropriate solutions.</p>`,
      quiz: [
        { q: "What is the primary benefit of studying case studies?", options: ["A) Entertainment", "B) Learning from real situations and proven solutions", "C) Memorizing facts", "D) Avoiding work"], answer: 1 },
        { q: "How should theory be applied in practice?", options: ["A) Never", "B) With rigid rules only", "C) Adapted thoughtfully to specific contexts and situations", "D) Only by senior management"], answer: 2 },
        { q: "Which element is NOT typically part of a practical application scenario?", options: ["A) Problem identification", "B) Solution implementation", "C) Random guessing", "D) Results measurement"], answer: 2 },
        { q: "Why are real organizational examples important?", options: ["A) They're not", "B) They demonstrate feasibility and provide actionable insights", "C) To confuse learners", "D) To discourage innovation"], answer: 1 },
        { q: "How do you adapt case study lessons to your own work?", options: ["A) Copy everything exactly", "B) Ignore them completely", "C) Analyze context and adapt relevant principles to your situation", "D) Only follow if management orders it"], answer: 2 }
      ]
    },
    {
      title: "Module 4: Standards, Compliance & Best Practices",
      content: `<h3>Industry Standards & Regulatory Requirements in ${courseTitle}</h3>
      <p>Every professional field operates within a framework of standards, regulations, and compliance requirements. Understanding and adhering to these is not optional — it's essential for professional credibility and legal compliance.</p>
      
      <h4>Key Standards & Regulations:</h4>
      <ul>
        <li><strong>Regulatory Compliance</strong> - Government regulations and legal requirements specific to your industry</li>
        <li><strong>Industry Standards</strong> - Established norms and benchmarks that define quality and professionalism</li>
        <li><strong>Ethical Guidelines</strong> - Code of conduct and ethical principles for professional behavior</li>
        <li><strong>Safety & Risk Management</strong> - Protocols to protect people, data, and organizational assets</li>
        <li><strong>Documentation & Record-Keeping</strong> - Proper procedures for maintaining records and evidence of compliance</li>
      </ul>
      
      <h4>Compliance Best Practices:</h4>
      <p>Compliance isn't something to resent — it's a foundation for trust and excellence. Organizations that maintain high compliance standards:</p>
      <ul>
        <li>Build stronger reputation and client confidence</li>
        <li>Reduce legal and financial risks</li>
        <li>Create safer, more professional work environments</li>
        <li>Establish consistent operational procedures</li>
        <li>Enable better decision-making and accountability</li>
      </ul>
      
      <h4>What You'll Learn:</h4>
      <ul>
        <li>Identify applicable regulations, standards, and policies in your industry</li>
        <li>Interpret compliance requirements and their implications for daily work</li>
        <li>Create and maintain proper documentation and records</li>
        <li>Develop compliance checklists and audit procedures</li>
        <li>Recognize risks and implement preventive controls</li>
        <li>Train team members on compliance standards and expectations</li>
        <li>Respond appropriately to compliance violations or gaps</li>
        <li>Build compliance into workflows and processes proactively</li>
        <li>Communicate compliance standards to stakeholders</li>
        <li>Stay updated on regulatory changes affecting your field</li>
      </ul>
      
      <p>Throughout your career, you'll encounter situations where standards and regulations apply. This module ensures you understand not just the "what" of compliance, but the "why" — so you become an advocate for best practices in your organization.</p>`,
      quiz: [
        { q: "Why are industry standards important in ${courseTitle}?", options: ["A) They're restrictive", "B) They define quality benchmarks and professional norms", "C) They don't matter", "D) Only for large companies"], answer: 1 },
        { q: "What is the primary purpose of compliance regulations?", options: ["A) To make work harder", "B) To protect people, assets, and organizational integrity", "C) To waste time", "D) To favor certain companies"], answer: 1 },
        { q: "How should you respond when regulations seem inconvenient?", options: ["A) Ignore them", "B) Follow them reluctantly", "C) Understand their purpose and follow as best practice", "D) Complain to management"], answer: 2 },
        { q: "What benefit does proper documentation provide?", options: ["A) No benefit", "B) Creates busywork", "C) Evidence of compliance, accountability, and professional standards", "D) Only for audits"], answer: 2 },
        { q: "How do high compliance standards affect organizational culture?", options: ["A) Negatively", "B) Builds trust, safety, and professional excellence", "C) No effect", "D) Only matters to executives"], answer: 1 }
      ]
    },
    {
      title: "Module 5: Advanced Concepts & Professional Development",
      content: `<h3>Advanced Topics & Continuing Professional Growth in ${courseTitle}</h3>
      <p>As you master the fundamentals of ${courseTitle}, it's time to explore advanced concepts that will set you apart as a true professional. This module also addresses your long-term career development and continuous learning.</p>
      
      <h4>Advanced Concepts:</h4>
      <ul>
        <li><strong>Strategic Thinking</strong> - Moving beyond day-to-day operations to long-term planning</li>
        <li><strong>Leadership & Influence</strong> - Leading teams and driving organizational change</li>
        <li><strong>Data Analytics & Decision-Making</strong> - Using data to inform better decisions</li>
        <li><strong>Innovation & Problem-Solving</strong> - Developing creative solutions to complex challenges</li>
        <li><strong>Professional Networking & Mentorship</strong> - Building relationships and supporting others' growth</li>
      </ul>
      
      <h4>Continuing Professional Development:</h4>
      <p>Your learning doesn't end with this certification. The best professionals understand that:</p>
      <ul>
        <li>Industries constantly evolve with new technologies and methods</li>
        <li>Staying current requires ongoing education and skill development</li>
        <li>Mentorship and peer learning accelerate professional growth</li>
        <li>Advanced certifications open new career opportunities</li>
        <li>Contributing to your field benefits everyone</li>
      </ul>
      
      <h4>What You'll Learn:</h4>
      <ul>
        <li>Develop strategic vision and long-term planning capabilities</li>
        <li>Lead teams effectively and influence organizational decisions</li>
        <li>Use data analysis to drive insights and business intelligence</li>
        <li>Cultivate creative thinking and innovative problem-solving skills</li>
        <li>Navigate complex, ambiguous business challenges with confidence</li>
        <li>Build and leverage professional networks for career growth</li>
        <li>Mentor junior colleagues and contribute to organizational learning</li>
        <li>Identify and pursue advanced certifications and specializations</li>
        <li>Stay informed about industry trends and emerging technologies</li>
        <li>Design your personal development plan for long-term career success</li>
        <li>Contribute thought leadership and expertise to your field</li>
        <li>Balance career advancement with personal fulfillment and values</li>
      </ul>
      
      <h4>Your Path Forward:</h4>
      <p>By completing this course, you've demonstrated commitment to professional excellence. The principles, practices, and knowledge you've gained form the foundation for a rewarding career in ${courseTitle}. Continue to learn, stay curious, challenge yourself, and help others grow. This is how industries advance and professionals thrive.</p>`,
      quiz: [
        { q: "What distinguishes advanced professionals from entry-level practitioners?", options: ["A) Years employed only", "B) Strategic thinking and continuous learning approach", "C) Job title alone", "D) Personal preferences"], answer: 1 },
        { q: "Why is continuous professional development important?", options: ["A) It's not", "B) Industries and technologies constantly evolve, requiring ongoing learning", "C) Only if you want management positions", "D) Only required by law"], answer: 1 },
        { q: "How can you stay current in your field?", options: ["A) Stop learning after certification", "B) Only attend annual conferences", "C) Pursue ongoing education, networking, and advanced certifications", "D) Hope things don't change"], answer: 2 },
        { q: "What role does mentorship play in professional growth?", options: ["A) No role", "B) Only for struggling professionals", "C) Critical for accelerated learning and career development", "D) Only for new hires"], answer: 2 },
        { q: "How should you approach your career progression?", options: ["A) Wait for promotions", "B) Actively invest in learning, build relationships, and seek challenges", "C) Only do what's required", "D) Focus only on salary"], answer: 1 }
      ]
    }
  ];
}

/* =============================================
   Generic placeholder exam bank — 20 multiple
   choice questions per course. Replace the
   "questions" array contents with your real exam
   questions later; keep the same shape:
   { q: "...", options: ["A","B","C","D"], answer: 0 }
   (answer = index of the correct option)
============================================= */
function getExamFor(courseTitle) {
  const questions = [];
  for (let i = 1; i <= 20; i++) {
    questions.push({
      q: `Sample question ${i} for "${courseTitle}". Replace this with a real exam question.`,
      options: [
        "Replace with correct answer",
        "Replace with distractor option B",
        "Replace with distractor option C",
        "Replace with distractor option D"
      ],
      correct: 0
    });
  }
  return questions;
}

const normalizeCertificateCode = (code) => {
  return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
};

/* =============================================
   Firestore-backed certificates (replaces old
   localStorage "bhf_certificate_records"). Certificates
   now live in the cloud so a certificate issued on one
   device can be verified from any device, by anyone.
============================================= */
let certificatesCache = [];
let resolveCertificatesReady;
const certificatesReadyPromise = new Promise((resolve) => {
  resolveCertificatesReady = resolve;
});

const loadCertificatesCache = async () => {
  try {
    const snapshot = await getDocs(collection(db, "certificates"));
    certificatesCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("Failed to load certificates from Firestore", error);
    certificatesCache = [];
  } finally {
    resolveCertificatesReady();
  }
};

// Synchronous read from the in-memory cache — used by pages (dashboard,
// course player) that already have the certificate list loaded at bootstrap.
const getCertificates = () => certificatesCache;

const findCertificateRecord = (code) => {
  const normalized = normalizeCertificateCode(code);
  return certificatesCache.find((cert) => cert.code === normalized) || null;
};

const findUserCertificate = (email, course) => {
  const normalizedEmail = (email || "").trim().toLowerCase();
  return certificatesCache.find((cert) => cert.email.toLowerCase() === normalizedEmail && cert.course === course) || null;
};

const getUserCertificates = (email) => {
  const normalizedEmail = (email || "").trim().toLowerCase();
  return certificatesCache.filter((cert) => cert.email.toLowerCase() === normalizedEmail);
};

const generateCertificateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 13; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BHF${randomPart}`;
};

// Writes the certificate to Firestore so it's visible from any device,
// then refreshes the local cache and returns the saved record.
const createCertificateFor = async ({ name, course, email, score, total }) => {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const code = generateCertificateCode();
  const certificate = {
    code,
    name,
    course,
    email,
    score,
    total,
    date,
    valid: true,
    issuedAt: new Date().toISOString()
  };
  await addDoc(collection(db, "certificates"), certificate);
  await loadCertificatesCache();
  return findCertificateRecord(code) || certificate;
};

// Live lookup straight from Firestore by code — used by the public "Verify
// Certificate" tool so it always reflects the source of truth (not just
// whatever this browser happened to have cached), regardless of which
// device or browser issued the certificate.
const fetchCertificateByCode = async (code) => {
  const normalized = normalizeCertificateCode(code);
  const q = query(collection(db, "certificates"), where("code", "==", normalized));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

const getCertificateStatusText = (certificate) => {
  if (!certificate) return "Invalid certificate.";
  return certificate.valid ? "Active" : "Revoked";
};

const getContentOverrides = () => {
  const stored = localStorage.getItem(CONTENT_STORE_KEY);
  try {
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const ADMIN_TEXT_TAGS = ["P", "SPAN", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "A", "LI", "STRONG", "EM"];
const ADMIN_IMAGE_TAGS = ["IMG"];
const BLOCKED_ADMIN_TAGS = ["HTML", "HEAD", "BODY", "SCRIPT", "STYLE", "NAV", "HEADER", "FOOTER", "FORM", "INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "LABEL"];

const saveContentOverride = (pageKey, selector, content, type = "text") => {
  const overrides = getContentOverrides();
  overrides[pageKey] = overrides[pageKey] || {};
  overrides[pageKey][selector] = { type, value: content };
  localStorage.setItem(CONTENT_STORE_KEY, JSON.stringify(overrides));
};

const clearContentOverride = (pageKey, selector) => {
  const overrides = getContentOverrides();
  if (!overrides[pageKey]) return;
  delete overrides[pageKey][selector];
  if (Object.keys(overrides[pageKey]).length === 0) {
    delete overrides[pageKey];
  }
  localStorage.setItem(CONTENT_STORE_KEY, JSON.stringify(overrides));
};

const applyContentOverrides = (pageKey) => {
  const overrides = getContentOverrides();
  const pageOverrides = overrides[pageKey] || {};
  Object.entries(pageOverrides).forEach(([selector, entry]) => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (!element) return;
        if (entry && typeof entry === "object") {
          if (entry.type === "image" && element.tagName === "IMG") {
            element.src = entry.value;
          } else if (entry.type === "text" && ADMIN_TEXT_TAGS.includes(element.tagName)) {
            element.textContent = entry.value;
          }
        }
      });
    } catch (error) {
      console.warn(`Skipped invalid override selector: ${selector}`, error);
    }
  });
};

const isValidImageUrl = (url) => {
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isSafeAdminElement = (element) => {
  if (!element) return false;
  const tag = element.tagName;
  if (BLOCKED_ADMIN_TAGS.includes(tag)) return false;
  return ADMIN_TEXT_TAGS.includes(tag) || ADMIN_IMAGE_TAGS.includes(tag);
};


const isAdmin = () => currentUser?.role === "admin";

const getAuth = () => currentUser;

const renderAdminHeaderNav = () => {
  const nav = document.querySelector(".nav-links");
  if (!nav) return;

  const logoutLink = document.getElementById("logout-button");
  const navLinks = [
    { href: "index.html", text: "Home" },
    { href: "programs.html", text: "Programs" },
    { href: "add-course.html", text: "Add Courses" },
    { href: "manage-courses.html", text: "Manage Courses" },
    { href: "index.html#verify", text: "Verify" }
  ];

  nav.innerHTML = "";
  navLinks.forEach(({ href, text }) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    nav.appendChild(link);
  });

  if (logoutLink) {
    logoutLink.classList.add("btn", "btn-secondary");
    nav.appendChild(logoutLink);
  }
};

const ensureAdminLink = () => {
  if (isAdmin()) {
    renderAdminHeaderNav();
  }
};

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact the academy office.",
  "auth/user-not-found": "This email is not registered yet. Please create an account first.",
  "auth/wrong-password": "Incorrect password entered. Please try again.",
  "auth/email-already-in-use": "An account with this email already exists. Please log in instead.",
  "auth/weak-password": "Password must be at least 6 characters long.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Please check your connection and try again."
};

const describeAuthError = (error) => AUTH_ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";

window.handleLogin = async (event) => {
  event.preventDefault();
  const note = document.getElementById("login-note");
  const submitButton = event.target?.querySelector('button[type="submit"]');
  const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";

  const banner = document.getElementById("login-banner");
  clearBannerMessage(banner);
  if (note) {
    note.textContent = "";
    note.className = "form-note";
  }

  if (!validateGmail(email)) {
    const message = "Please sign in with a valid Gmail address.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (password.length < 6) {
    const message = "Password must be at least 6 characters long.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (submitButton) submitButton.disabled = true;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const isAdminUser = email === ADMIN_EMAIL;
    const successMessage = "Login successful. Redirecting to your dashboard...";
    setFormNote(note, successMessage, "success");
    setBannerMessage(banner, successMessage, "success");

    window.setTimeout(() => {
      window.location.href = isAdminUser ? "admin.html" : "dashboard.html";
    }, 600);
  } catch (error) {
    const message = describeAuthError(error);
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    notifyUser(message, note);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }

  return false;
};

const bindLoginForm = () => {
  const form = document.getElementById("login-form");
  if (!form || form.dataset.bound === "true") return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (typeof window.handleLogin === "function") {
      window.handleLogin(event);
    } else {
      const note = document.getElementById("login-note");
      setFormNote(note, "Login is temporarily unavailable. Please refresh and try again.");
    }
  });

  form.dataset.bound = "true";
};

const bindSignupForm = () => {
  const form = document.getElementById("signup-form");
  if (!form || form.dataset.bound === "true") return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (typeof window.handleSignup === "function") {
      window.handleSignup(event);
    } else {
      const note = document.getElementById("signup-note");
      setFormNote(note, "Registration is temporarily unavailable. Please refresh and try again.");
    }
  });

  form.dataset.bound = "true";
};

const bindLogoutButtons = () => {
  const buttons = document.querySelectorAll('#logout-button, [data-action="logout"], .logout-button');
  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      await signOut(auth);
      window.location.href = "login.html";
    });

    button.dataset.bound = "true";
  });
};

const setFormNote = (noteElement, message, type = "error") => {
  if (!noteElement) return;
  noteElement.textContent = message;
  noteElement.className = `form-note ${type === "success" ? "success" : "error"}`;
  noteElement.style.color = type === "success" ? "#2f7a4b" : "#b33a3a";
};

const setBannerMessage = (bannerElement, message, type = "error") => {
  if (!bannerElement) return;
  bannerElement.textContent = message || "";
  bannerElement.className = `auth-alert ${message ? type : ""}`.trim();
  bannerElement.style.display = message ? "block" : "none";
  if (message) {
    bannerElement.removeAttribute("hidden");
    bannerElement.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    bannerElement.setAttribute("hidden", "");
  }
};

const clearBannerMessage = (bannerElement) => {
  if (!bannerElement) return;
  bannerElement.textContent = "";
  bannerElement.className = "auth-alert";
  bannerElement.style.display = "none";
  bannerElement.setAttribute("hidden", "");
};

const validateGmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return normalized === ADMIN_EMAIL || /^[a-z0-9._%+-]+@gmail\.com$/.test(normalized);
};

const ensureToastContainer = () => {
  let wrapper = document.getElementById("bhf-toast-wrapper");
  if (wrapper) return wrapper;
  wrapper = document.createElement("div");
  wrapper.id = "bhf-toast-wrapper";
  wrapper.className = "toast-wrapper";
  document.body.appendChild(wrapper);
  return wrapper;
};

const showToast = (message, type = "info") => {
  const wrapper = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  wrapper.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("toast-hide");
    window.setTimeout(() => toast.remove(), 300);
  }, 4200);
  toast.addEventListener("click", () => toast.remove());
};

const sendBrowserNotification = (title, body) => {
  if (!("Notification" in window)) return false;

  const show = () => {
    try {
      new Notification(title, {
        body,
        requireInteraction: true
      });
      return true;
    } catch (err) {
      console.warn("Notification failed", err);
      return false;
    }
  };

  if (Notification.permission === "granted") {
    return show();
  }

  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        show();
      }
    });
  }

  return false;
};

const notifyUser = (message, noteElement = null) => {
  const sent = sendBrowserNotification("BHF Certification Academy", message);
  showToast(message, "error");
  if (!sent && noteElement) {
    setFormNote(noteElement, message, "error");
  }
};

const requestNotificationPermission = () => {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission();
};

const clearAuth = async () => {
  await signOut(auth);
};

const isAuthenticated = () => {
  return Boolean(getAuth());
};

window.handleLogout = async () => {
  await clearAuth();
  window.location.href = "login.html";
};

/* FIX: the generic handler was matching the hero "Login to Portal" button
   (via .login-link) and overwriting its href BEFORE the home-page-specific
   code below could find it by href="login.html" — so the custom
   "My Dashboard" / "Admin Panel" label never showed. The hero button now
   has its own id (#hero-portal-btn) and is excluded here so the home block
   can fully control its text/href instead. */
const updateHeaderAuthLink = () => {
  const auth = getAuth();
  const authLink = document.getElementById("nav-auth-link");
  const logoutLink = document.getElementById("logout-button");
  const loginLinks = Array.from(
    document.querySelectorAll('a.login-link:not(#logout-button):not(#hero-portal-btn)')
  );
  const redirectPage = auth?.role === "admin" ? "admin.html" : "dashboard.html";
  const userLabel = auth && auth.name ? auth.name.split(" ")[0] : auth ? (auth.role === "admin" ? "Admin" : "Dashboard") : "Login";

  if (authLink) {
    if (!auth) {
      authLink.href = "login.html";
      authLink.textContent = "Login";
    } else {
      authLink.href = redirectPage;
      authLink.textContent = userLabel;
    }
  }

  loginLinks.forEach((link) => {
    if (!auth) {
      link.href = "login.html";
      link.textContent = "Login";
    } else {
      link.href = redirectPage;
      link.textContent = userLabel;
    }
  });

  if (logoutLink) {
    logoutLink.style.display = auth ? "inline-flex" : "none";
  }

  if (isAdmin()) {
    renderAdminHeaderNav();
  }
};

window.handleSignup = async (event) => {
  event.preventDefault();
  const note = document.getElementById("signup-note");
  const submitButton = event.target?.querySelector('button[type="submit"]');
  const name = document.getElementById("fullname")?.value.trim() || "";
  const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";
  const confirm = document.getElementById("confirm-password")?.value || "";

  const banner = document.getElementById("signup-banner");
  clearBannerMessage(banner);
  if (note) {
    note.textContent = "";
    note.className = "form-note";
  }

  if (!name) {
    const message = "Please enter your full name.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (!validateGmail(email)) {
    const message = "Please register with a valid Gmail address ending in @gmail.com.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (email === "admin@bhf.com") {
    const message = "This email is reserved for admin access only. Use a Gmail address to register.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (password.length < 6) {
    const message = "Password must be at least 6 characters long.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (password !== confirm) {
    const message = "Passwords do not match. Please try again.";
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
    return false;
  }

  if (submitButton) submitButton.disabled = true;

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    const successMessage = "Account created successfully. Redirecting to your dashboard...";
    setFormNote(note, successMessage, "success");
    setBannerMessage(banner, successMessage, "success");
    window.setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 800);
  } catch (error) {
    const message = describeAuthError(error);
    setFormNote(note, message, "error");
    setBannerMessage(banner, message, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }

  return false;
};

/* =============================================
   Backward-compat globals
   script.js used to be a classic (non-module) script,
   so its top-level consts/functions were implicitly
   visible to every other inline <script> on the page
   (course-detail.html, programs.html, etc.). Now that
   it's an ES module for Firebase imports, nothing
   leaks out automatically — so anything those other
   inline scripts still call has to be attached to
   window explicitly here.
============================================= */
window.getAuth = getAuth;
window.isAdmin = isAdmin;
window.isAuthenticated = isAuthenticated;
window.findSavedCourse = findSavedCourse;
window.getSavedCourses = getSavedCourses;
window.BHF_COURSES = BHF_COURSES;
window.mergeCoursesWithSaved = mergeCoursesWithSaved;
window.getCourseCatalog = getCourseCatalog;
window.getEnrollments = getEnrollments;
window.saveEnrollments = saveEnrollments;
window.updateHeaderAuthLink = updateHeaderAuthLink;
window.normalizeCourseTitle = normalizeCourseTitle;
window.showToast = showToast;
window.authReadyPromise = authReadyPromise;
window.ADMIN_EMAIL = ADMIN_EMAIL;
// Certificate helpers, exposed for course-detail.html's plain (non-module)
// inline script, which can't `import` from script.js directly.
window.createCertificateFor = createCertificateFor;
window.findUserCertificate = findUserCertificate;
window.getUserCertificates = getUserCertificates;
window.certificatesReadyPromise = certificatesReadyPromise;

(async function bootstrap() {
  await Promise.all([authReadyPromise, loadCoursesCache(), loadCertificatesCache()]);

  try {
    applyContentOverrides(page);
  } catch (error) {
    console.warn("applyContentOverrides failed", error);
  }
  updateHeaderAuthLink();
  bindLoginForm();
  bindLogoutButtons();
  window.addEventListener("DOMContentLoaded", () => {
    try {
      applyContentOverrides(page);
    } catch (error) {
      console.warn("applyContentOverrides failed", error);
    }
    updateHeaderAuthLink();
    bindLoginForm();
    bindLogoutButtons();
  });
  window.addEventListener("load", updateHeaderAuthLink);
  window.addEventListener("pageshow", updateHeaderAuthLink);

  runPageLogic();
})();

function runPageLogic() {

if (page === "home") {
  const auth = getAuth();
  const heroTitle = document.querySelector('.hero-copy h1');
  const welcomeCard = document.querySelector('.hero-copy .hero-welcome');
  /* FIX: was selecting by href="login.html", which updateHeaderAuthLink() had
     already changed by the time this ran. Now selects by a stable id instead. */
  const portalButton = document.getElementById('hero-portal-btn');

  if (auth) {
    const targetPage = auth.role === "admin" ? "admin.html" : "dashboard.html";
    if (heroTitle) {
      heroTitle.textContent = `Welcome back, ${auth.name.split(' ')[0]} — advance your career with trusted BHF learning programs.`;
    }
    if (welcomeCard) {
      welcomeCard.textContent = `You are signed in. Explore courses, manage your certifications, and review exam schedules.`;
      welcomeCard.style.display = "block";
    }
    if (portalButton) {
      portalButton.href = targetPage;
      portalButton.textContent = auth.role === "admin" ? "Admin Panel" : "My Dashboard";
    }
  }

  const form = document.getElementById("verify-form");
  const result = document.getElementById("verify-result");
  const preview = document.getElementById("verify-certificate-preview");

  const renderVerifyMessage = (message, ok) => {
    if (preview) {
      preview.innerHTML = "";
      preview.hidden = true;
    }
    result.innerHTML = message;
    result.style.color = ok === null ? "" : (ok ? "#2f7a4b" : "#b33a3a");
  };

  // Renders the same certificate design used on the exam page (course-detail.html),
  // so verifying a certificate shows the real thing, not just a text summary.
  const renderVerifiedCertificate = (record) => {
    result.innerHTML = "";
    result.style.color = "";
    if (!preview) return;
    preview.hidden = false;
    preview.innerHTML = `
      <div class="certificate-card">
        <div class="certificate-corner certificate-corner-tl"></div>
        <div class="certificate-corner certificate-corner-br"></div>
        <div class="certificate-frame"></div>
        <div class="certificate-code-pill">Certificate ID ${record.code}</div>

        <div class="certificate-inner">
          <div class="certificate-header">
            <img class="certificate-brand-mark" src="images/bhflogo.jpg" alt="BHF logo" />
            <div class="certificate-brand-title">Baguio Home for the Faithful</div>
            <div class="certificate-brand-subtitle">Growing in Faith. Transforming Lives.</div>
          </div>

          <div class="certificate-title-block">
            <h1 class="certificate-main-title">Certificate</h1>
            <p class="certificate-subtitle">of Completion</p>
          </div>

          <div class="certificate-body">
            <p class="certificate-note">This certifies that</p>
            <h2 class="certificate-recipient">${record.name}</h2>
            <div class="certificate-name-underline"></div>

            <p class="certificate-body-copy">
              has successfully completed the online certification program and has demonstrated understanding and proficiency in the required course.
            </p>

            <div class="certificate-program-row">
              <svg class="certificate-badge-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M22 40 L16 58 L32 50 L48 58 L42 40" fill="var(--accent)" />
                <circle cx="32" cy="26" r="20" fill="var(--accent-dark)" />
                <circle cx="32" cy="26" r="15" fill="var(--cert-lightblue)" />
                <path d="M24 26 L30 32 L41 19" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              </svg>
              <div class="certificate-program-text">
                <span class="certificate-program-label">Program Completed</span>
                <strong>${record.course}</strong>
                <p class="certificate-program-meta">Online Certification Program</p>
              </div>
            </div>
          </div>

          <div class="certificate-footer">
            <div class="certificate-footer-col">
              <svg class="certificate-footer-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--accent-dark)" stroke-width="1.6" />
                <path d="M3 9.5H21" stroke="var(--accent-dark)" stroke-width="1.6" />
                <path d="M8 3V6.5M16 3V6.5" stroke="var(--accent-dark)" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <p class="certificate-detail-label">Date Completed</p>
              <p class="certificate-detail">${record.date}</p>
            </div>

            <div class="certificate-seal-column">
              <div class="certificate-seal">
                <img src="images/bhflogo.jpg" alt="BHF seal" />
              </div>
              <p class="certificate-id-line">ID <strong>${record.code}</strong></p>
            </div>

            <div class="certificate-footer-col">
              <p class="certificate-signature-script">Baguio Home</p>
              <div class="certificate-signature-line"></div>
              <p class="certificate-detail-label">Authorized Signatory</p>
              <p class="certificate-detail certificate-signatory">Baguio Home for the Faithful</p>
            </div>
          </div>
        </div>

        <p class="certificate-verify-status" style="text-align:center; margin-top:1rem; font-weight:600; color:${record.valid ? '#2f7a4b' : '#b33a3a'};">
          Status: ${record.valid ? 'Active — this certificate is valid.' : 'Revoked — this certificate is no longer valid.'}
        </p>
      </div>
    `;
  };


  if (form && result) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const code = normalizeCertificateCode(document.getElementById("certificate-code").value);

      if (code.length !== 16) {
        renderVerifyMessage("Please enter a valid 16-character certificate code.", false);
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      renderVerifyMessage("Checking\u2026", null);

      try {
        // Always look this up live against Firestore (not the local cache),
        // so a certificate issued on any device, moments ago, verifies
        // correctly here — this is the whole point of "verify from another device".
        const record = await fetchCertificateByCode(code);
        if (!record) {
          renderVerifyMessage("No matching certificate was found. Please contact the academy office.", false);
          return;
        }
        renderVerifiedCertificate(record);
      } catch (error) {
        console.error("Certificate verification failed", error);
        renderVerifyMessage("Something went wrong while verifying. Please try again.", false);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  /* NEW: reveal-on-scroll for any element with the .reveal class */
  const revealTargets = document.querySelectorAll(".reveal");
  if (revealTargets.length) {
    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealTargets.forEach((target) => revealObserver.observe(target));
    } else {
      // Fallback for browsers without IntersectionObserver support
      revealTargets.forEach((target) => target.classList.add("is-visible"));
    }
  }

  /* NEW: animated count-up for hero stats with a data-count attribute */
  const countTargets = document.querySelectorAll("[data-count]");
  const animateCount = (element) => {
    const target = Number(element.dataset.count) || 0;
    const suffix = element.dataset.suffix || "";
    const duration = 1200;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      element.textContent = `${current}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  if (countTargets.length) {
    if ("IntersectionObserver" in window) {
      const countObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              countObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      countTargets.forEach((target) => countObserver.observe(target));
    } else {
      countTargets.forEach((target) => animateCount(target));
    }
  }
}

if (page === "signup") {
  if (isAuthenticated()) {
    window.location.href = "dashboard.html";
  }
  bindSignupForm();
}

if (page === "programs") {
  const catalogBase = typeof BHF_COURSES !== "undefined" && Array.isArray(BHF_COURSES)
    ? BHF_COURSES
    : [];

  const defaultCourses = catalogBase.length
    ? catalogBase.map((course) => ({
        title: course.title,
        description: course.description || course.desc || "Professional certification course for continued learning.",
        level: course.level || "Intermediate",
        duration: course.duration || "4 Weeks",
        category: course.category || "General",
        img: course.img || course.image
      }))
    : [
        {
          title: "Hospitality Leadership",
          description: "Lead service teams with confidence and improve guest satisfaction.",
          level: "Intermediate",
          duration: "6 Weeks",
          category: "Leadership"
        },
        {
          title: "Customer Experience Essentials",
          description: "Strengthen communication, retention, and service recovery skills.",
          level: "Beginner",
          duration: "4 Weeks",
          category: "Service"
        },
        {
          title: "Operations and Workflow Mastery",
          description: "Learn efficient processes for daily operations and team coordination.",
          level: "Advanced",
          duration: "8 Weeks",
          category: "Operations"
        },
        {
          title: "Business Growth Strategy",
          description: "Build a practical roadmap for scaling service-based businesses.",
          level: "Intermediate",
          duration: "5 Weeks",
          category: "Business"
        },
        {
          title: "Digital Hospitality Tools",
          description: "Use modern systems to organize bookings, clients, and communication.",
          level: "Beginner",
          duration: "3 Weeks",
          category: "Technology"
        },
        {
          title: "Team Development and Coaching",
          description: "Coach your team to deliver consistent, high-quality experiences.",
          level: "Advanced",
          duration: "7 Weeks",
          category: "Leadership"
        }
      ];

  const programCatalog = mergeCoursesWithSaved(defaultCourses);

  const grid = document.getElementById("courses-grid");
  const departmentsGrid = document.getElementById("departments");
  const search = document.getElementById("course-search");
  const filter = document.getElementById("course-filter");
  const countLabel = document.querySelector(".course-count");
  let activeCategory = null;

  const categoryImages = {
    "Hospitality Management": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
    "Information Technology": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    "Business & Management": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
    "Professional Skills": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80"
  };

  const renderProgramsOverview = () => {
    if (departmentsGrid) {
      const categories = ["Hospitality Management", "Information Technology", "Business & Management", "Professional Skills"];
      departmentsGrid.innerHTML = categories.map((category) => {
        const matching = programCatalog.filter((course) => (course.category || "General") === category);
        return `
          <article class="department-card">
            <img src="${categoryImages[category] || 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80'}" alt="${category}">
            <div class="department-card-content">
              <h3>${category}</h3>
              <p>${matching.length} courses available for ${category.toLowerCase()}.</p>
              <button class="btn btn-explore" type="button" data-category="${category}">Explore</button>
            </div>
          </article>
        `;
      }).join("");

      departmentsGrid.querySelectorAll(".btn-explore").forEach((button) => {
        button.addEventListener("click", () => {
          const category = button.dataset.category;
          if (category && typeof window.openCourseModal === "function") {
            window.openCourseModal(category);
          }
        });
      });
    }

    if (countLabel) {
      countLabel.textContent = `${programCatalog.length} Courses available`;
    }
  };

  const renderProgramCourses = () => {
    if (!grid) return;

    const query = (search?.value || "").toLowerCase();
    const selected = filter?.value || "All";
    const auth = getAuth();

    const filtered = programCatalog.filter((course) => {
      const textValues = [course.title, course.description, course.category, course.level, course.duration].filter(Boolean);
      const matchesQuery = textValues.some((value) => value.toLowerCase().includes(query));
      const categoryMatches = !activeCategory || (course.category || "General") === activeCategory;
      const matchesFilter = selected === "All" || course.category === selected;
      return matchesQuery && categoryMatches && matchesFilter;
    });

    grid.innerHTML = filtered.length
      ? filtered
          .map(
            (course) => `
              <article class="course-card category-${(course.category || 'general').replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}">
                ${course.img ? `<img src="${course.img}" alt="${course.title}" class="course-card-image" />` : ''}
                <div class="course-card-content">
                  <h3>${course.title}</h3>
                  <p>${course.description}</p>
                  <div class="course-meta">
                    <span class="pill">${course.category}</span>
                    <span class="pill">${course.level || 'Intermediate'}</span>
                    <span class="pill">${course.duration || '4 Weeks'}</span>
                  </div>
                  <a class="btn btn-primary" href="${auth ? `course-detail.html?course=${encodeURIComponent(course.title)}&category=${encodeURIComponent(course.category)}` : "login.html"}">
                    ${auth ? "View Course" : "Login to Enroll"}
                  </a>
                </div>
              </article>
            `
          )
          .join("")
      : '<p class="form-note">No courses match your search yet.</p>';
  };

  const openProgramCategory = (category) => {
    activeCategory = category;
    const modal = document.getElementById("courseModal");
    const title = document.getElementById("courseModalTitle");
    if (title) {
      title.textContent = `${category} Courses`;
    }
    if (modal) {
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    renderProgramCourses();
  };

  window.openCourseModal = openProgramCategory;

  // Close course modal functionality
  const courseModal = document.getElementById("courseModal");
  const closeModalBtn = courseModal?.querySelector(".close-modal-btn");
  const modalBackdrop = courseModal?.querySelector(".course-modal-backdrop");

  const closeCourseModal = () => {
    if (courseModal) {
      courseModal.hidden = true;
      document.body.style.overflow = "auto";
      activeCategory = null;
    }
  };

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeCourseModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeCourseModal);
  }

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && courseModal && !courseModal.hidden) {
      closeCourseModal();
    }
  });

  search?.addEventListener("input", renderProgramCourses);
  filter?.addEventListener("change", renderProgramCourses);
  renderProgramsOverview();
  renderProgramCourses();

  const schedule = document.getElementById("exam-schedule");
  if (schedule) {
    schedule.textContent = isAuthenticated()
      ? "No exams are scheduled yet. Please check back soon for certification dates."
      : "Sign in to view upcoming certification exam dates.";
  }
}

if (page === "login") {
  if (isAuthenticated()) {
    const auth = getAuth();
    window.location.href = auth.role === "admin" ? "admin.html" : "dashboard.html";
  }

  const form = document.getElementById("login-form");
  bindLoginForm();

  if (isAdmin() && form) {
    const adminHint = document.createElement('p');
    adminHint.className = 'form-note success';
    adminHint.textContent = 'Admin users can edit content from the admin panel after login.';
    form.parentNode?.insertBefore(adminHint, form.nextSibling);
  }
}

if (page === "dashboard") {
  const auth = getAuth();
  const welcome = document.getElementById("dashboard-welcome");
  const logoutButton = document.getElementById("logout-button");
  const examSchedule = document.getElementById("dashboard-schedule");
  const adminPanelAction = document.getElementById("admin-panel-action");

  if (!auth) {
    window.location.href = "login.html";
  } else {
    const enrollments = getEnrollments();
    const userEmail = auth.email.toLowerCase();
    const userEnrolls = Array.isArray(enrollments[userEmail]) ? enrollments[userEmail] : [];
    const certificates = getUserCertificates(auth.email);

    if (welcome) {
      welcome.textContent = `Welcome back, ${auth.name.split(" ")[0]}!`;
    }

    if (examSchedule) {
      examSchedule.textContent = "No scheduled exams yet. Your certification dates will appear here once they are available.";
    }

    const completedCount = document.getElementById("completed-count");
    const inProgressCount = document.getElementById("inprogress-count");
    const certifiedCount = document.getElementById("certified-count");

    if (completedCount) {
      completedCount.textContent = String(certificates.length);
    }
    if (inProgressCount) {
      inProgressCount.textContent = String(userEnrolls.length);
    }
    if (certifiedCount) {
      certifiedCount.textContent = String(certificates.length);
    }

    if (isAdmin() && adminPanelAction) {
      adminPanelAction.classList.remove("hidden");
      adminPanelAction.innerHTML = '<a class="btn btn-primary" href="admin.html">Go to Admin Editor</a>';
    }

    logoutButton?.addEventListener("click", () => {
      clearAuth();
      window.location.href = "login.html";
    });

    /* ---------- Dashboard metric card modals ---------- */
    const dashboardModal = document.getElementById("dashboard-modal");
    const dashboardModalTitle = document.getElementById("dashboard-modal-title");
    const dashboardModalContent = document.getElementById("dashboard-modal-content");
    const dashboardModalClose = document.getElementById("dashboard-modal-close");

    const escapeHtml = (str) =>
      String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));

    const openDashboardModal = (type) => {
      if (!dashboardModal) return;

      if (type === "certifications") {
        dashboardModalTitle.textContent = "Your Certificates";
        if (!certificates.length) {
          dashboardModalContent.innerHTML = `<p class="form-note">You haven't earned any certificates yet. Pass a course exam to earn one.</p>`;
        } else {
          dashboardModalContent.innerHTML = `<ul class="dashboard-modal-list">${certificates.map((cert) => `
            <li class="dashboard-modal-list-item">
              <div>
                <strong>${escapeHtml(cert.course)}</strong>
                <p class="form-note">ID ${escapeHtml(cert.code)} &middot; ${escapeHtml(cert.date)}</p>
              </div>
              <a class="btn btn-primary" href="course-detail.html?course=${encodeURIComponent(cert.course)}&view=certificate">View Certificate</a>
            </li>`).join("")}</ul>`;
        }
      } else if (type === "completed") {
        dashboardModalTitle.textContent = "Completed Courses";
        if (!certificates.length) {
          dashboardModalContent.innerHTML = `<p class="form-note">No completed courses yet.</p>`;
        } else {
          dashboardModalContent.innerHTML = `<ul class="dashboard-modal-list">${certificates.map((cert) => `
            <li class="dashboard-modal-list-item">
              <div><strong>${escapeHtml(cert.course)}</strong></div>
              <a class="btn btn-secondary" href="course-detail.html?course=${encodeURIComponent(cert.course)}">Open Course</a>
            </li>`).join("")}</ul>`;
        }
      } else if (type === "in-progress") {
        dashboardModalTitle.textContent = "Courses In Progress";
        if (!userEnrolls.length) {
          dashboardModalContent.innerHTML = `<p class="form-note">No courses in progress yet. Explore the programs page to enroll.</p>`;
        } else {
          dashboardModalContent.innerHTML = `<ul class="dashboard-modal-list">${userEnrolls.map((title) => `
            <li class="dashboard-modal-list-item">
              <div><strong>${escapeHtml(title)}</strong></div>
              <a class="btn btn-secondary" href="course-detail.html?course=${encodeURIComponent(title)}">Continue</a>
            </li>`).join("")}</ul>`;
        }
      } else {
        return;
      }

      dashboardModal.classList.remove("hidden");
    };

    const closeDashboardModal = () => {
      dashboardModal?.classList.add("hidden");
    };

    document.querySelectorAll("[data-modal]").forEach((btn) => {
      btn.addEventListener("click", () => openDashboardModal(btn.dataset.modal));
    });
    dashboardModalClose?.addEventListener("click", closeDashboardModal);
    dashboardModal?.addEventListener("click", (e) => {
      if (e.target === dashboardModal) closeDashboardModal();
    });
  }
}

if (page === "admin") {
  const auth = getAuth();
  if (!auth) {
    window.location.href = "login.html";
  } else if (!isAdmin()) {
    window.location.href = "dashboard.html";
  } else {
    const adminForm = document.getElementById("admin-form");
    const pageSelect = document.getElementById("admin-page");
    const selectorInput = document.getElementById("admin-selector");
    const contentTypeSelect = document.getElementById("admin-content-type");
    const contentInput = document.getElementById("admin-content");
    const saveButton = document.getElementById("admin-save");
    const removeButton = document.getElementById("admin-remove");
    const clearButton = document.getElementById("admin-clear");
    const overridesList = document.getElementById("admin-overrides");
    const adminNote = document.getElementById("admin-note");

  const renderOverrides = () => {
    const overrides = getContentOverrides();
    const selectedPage = pageSelect?.value || "home";
    const pageOverrides = overrides[selectedPage] || {};

    if (!overridesList) return;
    overridesList.innerHTML = Object.keys(pageOverrides).length
      ? Object.entries(pageOverrides)
          .map(([selector, entry]) => {
            const displayValue = entry?.type === "image"
              ? `Image URL: ${entry.value}`
              : `${entry?.value}`;
            return `
              <div class="override-item">
                <strong>${selector}</strong>
                <p>${displayValue.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                <button type="button" data-selector="${selector}">Edit</button>
                <button type="button" data-remove-selector="${selector}">Remove</button>
              </div>
            `;
          })
          .join("")
      : '<p class="form-note">No saved overrides for this page yet.</p>';
  };

  const showAdminNote = (message, type = "success") => {
    if (!adminNote) return;
    adminNote.textContent = message;
    adminNote.className = `form-note ${type}`;
  };

  pageSelect?.addEventListener("change", renderOverrides);

  saveButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetPage = pageSelect?.value || "home";
    const selector = selectorInput?.value.trim();
    const contentType = contentTypeSelect?.value || "text";
    const content = contentInput?.value.trim() || "";
    const isEditingCurrentPage = targetPage === page;

    if (!selector || !content) {
      showAdminNote("Enter a page and selector plus new content before saving.", "error");
      return;
    }

    if (contentType === "image" && !isValidImageUrl(content)) {
      showAdminNote("Enter a valid image URL to update photos.", "error");
      return;
    }

    const elements = isEditingCurrentPage ? Array.from(document.querySelectorAll(selector)) : [];
    if (isEditingCurrentPage && !elements.length) {
      showAdminNote("No matching page elements were found for that selector on the current page.", "error");
      return;
    }

    if (isEditingCurrentPage && contentType === "image") {
      const invalidImage = elements.some((element) => element.tagName !== "IMG");
      if (invalidImage) {
        showAdminNote("Photo URL updates only apply to <img> elements.", "error");
        return;
      }
    }

    if (isEditingCurrentPage && contentType === "text") {
      const invalidText = elements.some((element) => !ADMIN_TEXT_TAGS.includes(element.tagName));
      if (invalidText) {
        showAdminNote("Text updates only apply to visible text elements such as headings, paragraphs, and links.", "error");
        return;
      }
    }

    saveContentOverride(targetPage, selector, content, contentType);
    showAdminNote(
      isEditingCurrentPage
        ? "Content override saved and applied to this page."
        : "Content override saved. It will take effect when the selected page is loaded.",
      "success"
    );
    renderOverrides();
  });

  removeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetPage = pageSelect?.value || "home";
    const selector = selectorInput?.value.trim();

    if (!selector) {
      showAdminNote("Enter the selector to remove.", "error");
      return;
    }

    clearContentOverride(targetPage, selector);
    showAdminNote("Content override removed.", "success");
    renderOverrides();
  });

  clearButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetPage = pageSelect?.value || "home";
    const overrides = getContentOverrides();
    if (overrides[targetPage]) {
      delete overrides[targetPage];
      localStorage.setItem(CONTENT_STORE_KEY, JSON.stringify(overrides));
      showAdminNote("All overrides removed for this page.", "success");
      renderOverrides();
    }
  });

  overridesList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const editSelector = target.dataset.selector;
    const removeSelector = target.dataset.removeSelector;
    const currentPage = pageSelect?.value || "home";
    const overrides = getContentOverrides()[currentPage] || {};

    if (editSelector) {
      selectorInput.value = editSelector;
      const entry = overrides[editSelector];
      contentInput.value = entry?.value || "";
      if (contentTypeSelect) {
        contentTypeSelect.value = entry?.type || "text";
      }
      showAdminNote("Loaded override for editing.", "success");
    }

    if (removeSelector) {
      clearContentOverride(currentPage, removeSelector);
      showAdminNote("Override removed.", "success");
      renderOverrides();
    }
  });

  renderOverrides();
  }
}

if (page === "add-course") {
  const courseForm = document.getElementById("course-builder-form");
  const titleInput = document.getElementById("course-title");
  const categoryInput = document.getElementById("course-category");
  const descriptionInput = document.getElementById("course-description");
  const imageInput = document.getElementById("course-image");
  const pdfInput = document.getElementById("course-pdf");
  const pdfUrlInput = document.getElementById("course-pdf-url");
  const activeInput = document.getElementById("course-active");
  const validityInput = document.getElementById("course-validity-days");
  const examToggle = document.getElementById("course-exam-toggle");
  const questionBuilder = document.getElementById("question-builder");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const courseNote = document.getElementById("course-builder-note");

  if (!isAuthenticated()) {
    window.location.href = "login.html";
  }

  if (!isAdmin()) {
    window.location.href = "dashboard.html";
  }

  const readFileAsDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  };

  const buildQuestionCard = (index) => {
    return `
      <div class="question-card">
        <div class="form-row">
          <label>Question ${index}</label>
          <input type="text" class="course-question-text" placeholder="Enter a question" />
        </div>
        <div class="form-row">
          <label>Options</label>
          <div class="question-options">
            <input type="text" class="course-question-option" placeholder="Option 1" />
            <input type="text" class="course-question-option" placeholder="Option 2" />
            <input type="text" class="course-question-option" placeholder="Option 3" />
            <input type="text" class="course-question-option" placeholder="Option 4" />
          </div>
        </div>
        <div class="form-row">
          <label>Correct answer index</label>
          <input type="number" class="course-question-answer" min="0" max="3" value="0" />
        </div>
      </div>
    `;
  };

  const getQuestionData = () => {
    return Array.from(questionBuilder.querySelectorAll('.question-card')).map((card, index) => {
      const questionText = card.querySelector('.course-question-text')?.value.trim() || `Question ${index + 1}`;
      const options = Array.from(card.querySelectorAll('.course-question-option')).map((option) => option.value.trim()).filter(Boolean);
      const answer = parseInt(card.querySelector('.course-question-answer')?.value, 10);

      while (options.length < 4) {
        options.push("Option placeholder");
      }

      return {
        q: questionText,
        options,
        answer: Number.isFinite(answer) ? Math.min(Math.max(answer, 0), options.length - 1) : 0
      };
    });
  };

  const refreshQuestionSection = () => {
    if (!examToggle) return;
    questionBuilder.hidden = !examToggle.checked;
  };

  if (examToggle) {
    examToggle.addEventListener('change', refreshQuestionSection);
    refreshQuestionSection();
  }

  if (addQuestionBtn) {
    addQuestionBtn.addEventListener('click', () => {
      const questionCount = questionBuilder.querySelectorAll('.question-card').length + 1;
      questionBuilder.insertAdjacentHTML('beforeend', buildQuestionCard(questionCount));
    });
  }

  courseForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!titleInput) return;

    const title = titleInput.value.trim();
    const category = categoryInput?.value || 'Custom Programs';
    const description = descriptionInput?.value.trim() || 'No description provided for this course yet.';
    const image = imageInput?.value.trim() || 'images/training.svg';
    const pdfUrl = pdfUrlInput?.value.trim() || '';
    const active = activeInput?.checked ?? true;
    const validityDays = Number(validityInput?.value) || 365;
    const examEnabled = examToggle?.checked ?? false;

    if (!title) {
      setFormNote(courseNote, 'Enter a course title before saving.', 'error');
      return;
    }

    let pdfData = '';
    if (pdfInput?.files?.length) {
      try {
        pdfData = await readFileAsDataUrl(pdfInput.files[0]);
      } catch (error) {
        setFormNote(courseNote, 'Unable to read the selected PDF. Please try again or use a URL instead.', 'error');
        return;
      }
    }

    const course = {
      title,
      category,
      description,
      img: image,
      pdfUrl,
      pdfData,
      active,
      validityDays,
      examEnabled,
      questions: examEnabled ? getQuestionData() : [],
      level: 'Intermediate',
      duration: '4 Weeks'
    };

    try {
      await addSavedCourse(course);
      setFormNote(courseNote, `Course "${title}" has been saved successfully.`, 'success');
      showToast(`Saved course: ${title}`, 'success');

      window.setTimeout(() => {
        window.location.href = 'manage-courses.html';
      }, 900);
    } catch (error) {
      console.error('Failed to save course to Firestore', error);
      setFormNote(courseNote, 'Unable to save the course. Please try again.', 'error');
    }
  });
}

if (page === "manage-courses") {
  const auth = getAuth();
  if (!auth) {
    window.location.href = "login.html";
  } else if (!isAdmin()) {
    window.location.href = "dashboard.html";
  }

  const adminCourseList = document.getElementById('admin-course-list');

  const renderManageCourses = () => {
    if (!adminCourseList) return;
    const saved = getSavedCourses();

    if (!saved.length) {
      adminCourseList.innerHTML = `
        <h2>Published Courses</h2>
        <p class="form-note">No saved courses found yet. Use Add Course to publish a new course.</p>
      `;
      return;
    }

    adminCourseList.innerHTML = `
      <h2>Published Courses</h2>
      <div class="course-grid admin-course-grid">
        ${saved
          .map((course) => {
            const activeLabel = course.active ? 'Active' : 'Inactive';
            const buttonText = course.active ? 'Disable' : 'Activate';
            return `
              <article class="course-card admin-course-card">
                <div class="course-body">
                  <span class="pill">${course.category || 'General'}</span>
                  <h3>${course.title}</h3>
                  <p>${course.description || 'No description provided.'}</p>
                  <div class="course-meta">
                    <span class="pill">${course.level || 'Intermediate'}</span>
                    <span class="pill">${course.duration || '4 Weeks'}</span>
                    <span class="pill ${course.active ? 'pill-active' : 'pill-inactive'}">${activeLabel}</span>
                  </div>
                </div>
                <div class="course-actions admin-course-actions">
                  <a class="btn btn-secondary" href="course-detail.html?course=${encodeURIComponent(course.title)}&category=${encodeURIComponent(course.category)}">Preview</a>
                  <button class="btn btn-primary" type="button" data-action="toggle-active" data-title="${course.title}">${buttonText}</button>
                  <button class="btn btn-secondary" type="button" data-action="delete-course" data-title="${course.title}">Delete</button>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  };

  adminCourseList?.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.action;
    const title = button.dataset.title;
    if (!action || !title) return;

    button.disabled = true;

    if (action === 'toggle-active') {
      const course = findSavedCourse(title);
      if (!course) { button.disabled = false; return; }
      const wasActive = course.active;
      await updateSavedCourse(title, { active: !wasActive });
      showToast(`${course.title} is now ${wasActive ? 'disabled' : 'active'}.`, 'success');
      renderManageCourses();
    }

    if (action === 'delete-course') {
      const confirmed = window.confirm(`Delete the course "${title}" from the catalog?`);
      if (!confirmed) { button.disabled = false; return; }
      await removeSavedCourse(title);
      showToast(`Course deleted: ${title}`, 'info');
      renderManageCourses();
    }
  });

  renderManageCourses();
}

// Initialize programs page if on programs.html
if (page === "programs") {
  // Wait a moment for DOM to settle, then initialize programs page functions
  const initializePrograms = () => {
    try {
      if (typeof window.renderDepartments === 'function') window.renderDepartments();
      if (typeof window.bindCourseModalActions === 'function') window.bindCourseModalActions();
      if (typeof window.renderCourses === 'function') window.renderCourses();
      if (typeof window.initModal === 'function') window.initModal();
    } catch (e) {
      console.error('Failed to initialize programs page:', e);
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePrograms);
  } else {
    // DOM is already loaded, call immediately but in a microtask to ensure inline script has executed
    Promise.resolve().then(initializePrograms);
  }
}
}