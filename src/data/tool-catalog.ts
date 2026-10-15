export type ToolKind = "ai" | "browser";

export type ToolItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  kind: ToolKind;
  icon: string;
};

const groups: Array<{ category: string; kind: ToolKind; items: string }> = [
  { category: "Business", kind: "ai", items: `AI Customer Support Reply Generator|AI Proposal and Quotation Builder|Spreadsheet AI Analyst|Email and Follow-up Writer|Website SEO Auditor|Meeting Notes to Action Items|Invoice and Receipt Data Extractor|Lead Qualification Assistant|Business Plan Generator|Competitor Comparison Tool|Job Description Generator|Interview Question Generator|Customer Review Analyzer|Website FAQ Generator|Product Description Generator|Product Recommendation Assistant|Appointment Scheduling Assistant|Contract and Policy Summarizer|Plain-English Workflow Builder|Business Report Generator|CRM Note Summarizer|Sales Call Script Writer|Pricing and Quotation Estimator|Customer Feedback Classifier|Knowledge-Base Chatbot|Document Data Extractor|SOP and Process Documentation Writer|Email Inbox Categorizer|Support Ticket Priority Classifier|Form Response Analyzer` },
  { category: "Writing & Research", kind: "ai", items: `Chat With PDF|AI Paraphraser and Rewriter|Research Assistant|Grammar and Clarity Checker|Essay Planner|Citation Formatter|Text Simplifier|Reading-Level Converter|Long-Document Summarizer|Meeting Transcript Summarizer|Audio Transcription Planner|AI Translation Tool|Email Tone Analyzer|Cover Letter Writer|Resume Bullet Improver|Job Application Tracker|Personal Knowledge-Base Assistant|Task Prioritization Assistant|Calendar Planning Assistant|PDF Table Extraction Assistant|Image Text Extraction Assistant|Handwritten Notes Digitizer|Duplicate Document Review|Fact-Checking Research Planner|Article Outline Generator|Comparison Report Generator|Proofreading Assistant|Notes-to-Flashcards Generator|Document Quiz Generator` },
  { category: "Study & Education", kind: "ai", items: `Notes-to-Quiz Generator|English Speaking Practice Coach|Step-by-Step Math Tutor|Study Timetable Generator|Assignment Rubric Checker|Lecture Summarizer|Vocabulary Trainer|Grammar Exercise Generator|Pronunciation Practice Coach|Exam Paper Generator|Past-Paper Topic Analyzer|Science Concept Explainer|Coding Tutor|Language Conversation Partner|Essay Feedback Tool|Research Topic Finder|Study-Abroad Shortlist Builder|Scholarship Search Planner|Personal Statement Reviewer|Interview Preparation Coach|Bibliography Checker|Reading Comprehension Generator|Spaced-Repetition Planner|Educational Video Summary Planner|Concept Map Planner` },
  { category: "Creators & Social", kind: "ai", items: `Content Repurposing Studio|YouTube Packaging Assistant|Social Media Content Planner|Short-Video Scriptwriter|Hook Generator|Thumbnail Concept Generator|Caption and Subtitle Writer|Hashtag Suggestion Tool|Carousel Post Writer|LinkedIn Post Assistant|Newsletter Writer|Blog-to-Video Script Converter|Podcast Show-Notes Generator|Video Chapter Generator|Content Calendar Generator|Brand Voice Analyzer|Content Brief Generator|Image Prompt Generator|Storyboard Planner|Ad Copy Generator|UGC Script Generator|Product Photography Prompt Writer|Content Readability Checker|Content Pattern Analyzer|Competitor Content Gap Analyzer|Comment Sentiment Analyzer|Community Reply Assistant|Content Repackaging Tool|Voiceover Script Formatter|Transcript Cleaner` },
  { category: "Image, Audio & Video", kind: "ai", items: `Background Removal Guide|Image Upscaling Assistant|Image Caption Generator|Photo Restoration Planner|Product Image Background Prompt|Image-to-Prompt Generator|Image Alt-Text Generator|Visual Color Palette Assistant|Logo Concept Generator|Poster and Flyer Copywriter|Video Transcript Assistant|Video Summarizer|Subtitle Translator|Subtitle File Planner|Audio Noise-Removal Guide|Podcast Clip Finder|Filler-Word Review Assistant|Video-to-Blog Converter|Long-Video-to-Shorts Planner|Scene and Shot-List Planner|Video Prompt Optimizer|Voiceover Timing Planner|Audio Chapter Generator|Music-Free Sound-Effect Planner|Video Accessibility Checker` },
  { category: "Developer & Automation", kind: "ai", items: `Workflow Generator from Plain English|API Request Builder|Code Explainer and Debugger|SQL Query Generator|Regex Pattern Generator|API Documentation Writer|Webhook Payload Explainer|Database Schema Designer|Test-Case Generator|Unit-Test Writer|Code Documentation Writer|Git Commit Message Writer|GitHub Issue Formatter|Error-Log Analyzer|Prompt Optimizer|System-Prompt Evaluator|Chatbot Knowledge-Base Planner|AI Agent Workflow Planner|Automation ROI Calculator|Workflow Failure Explainer|Integration Compatibility Checker|Database Migration Assistant|Regex Explainer|HTML/CSS Component Planner|Form-to-Database Schema Generator|Data Mapping Assistant` },
  { category: "Ecommerce & Marketing", kind: "ai", items: `Product Listing Optimizer|Marketplace Title Generator|Product Comparison Table Writer|Abandoned-Cart Email Writer|Customer Review Reply Generator|Product FAQ Generator|Return-Request Classifier|Order-Support Reply Assistant|Product Catalog Deduplication Planner|Inventory Report Analyzer|Ad Campaign Brief Generator|Landing-Page Copy Analyzer|Conversion Audit Assistant|Email Campaign Planner|Audience Persona Generator|Customer Survey Analyzer|Brand Positioning Assistant|Sales Funnel Audit Assistant|Local Business Description Writer|Business Profile Post Writer|Sales Objection Coach|Customer Segmentation Planner|Lead Magnet Generator|Marketing Campaign Report Writer|Competitor Pricing Research Planner` },
  { category: "Career & Freelancing", kind: "ai", items: `Resume Builder|Resume-to-Job Matcher|ATS Keyword Checker|Portfolio Project Planner|Freelancer Proposal Writer|Freelance Profile Optimizer|Client Discovery Questionnaire Builder|Project Scope Generator|Project Estimation Assistant|Freelance Rate Calculator|Recruiter Screening Assistant|Behavioral Interview Coach|Job Listing Summarizer|Skill-Gap Analyzer|Career Roadmap Generator|Professional Bio Writer|LinkedIn Profile Reviewer|Networking Message Writer|Cold-Email Personalizer|Client Onboarding Form Builder|Freelancer Contract Checklist|Portfolio Case-Study Writer|Job Application Document Organizer|Meeting Follow-up Assistant` },
  { category: "Personal Productivity", kind: "ai", items: `Daily Planner|Goal Breakdown Assistant|Habit Review Assistant|Grocery List Generator|Ingredient-Based Recipe Planner|Travel Itinerary Planner|Packing List Generator|Expense Categorization Assistant|Subscription Audit Planner|Household Task Planner|Gift Idea Finder|Decision Comparison Matrix|Message Tone Improver|Personal Document Organizer|Book Discussion Guide|Learning-Path Planner|Journal Reflection Assistant|Time-Use Analyzer|Checklist Generator|Multilingual Message Translator` },
  { category: "Specialized", kind: "ai", items: `Website Accessibility Auditor|Website Copy Consistency Auditor|Privacy-Policy Draft Assistant|Security Checklist Generator|Phishing-Awareness Training Planner|Data Anonymization Planner|Document Redaction Assistant|Tender and RFP Summarizer|Grant Application Organizer|Nonprofit Report Writer|Real Estate Listing Assistant|Property Listing Comparison|Legal Document Issue Spotter|Medical Document Plain-Language Explainer|Appointment Intake Form Assistant|Literature Review Organizer|Scientific Paper Comparison|Manufacturing SOP Generator|Logistics Document Parser|Procurement Quote Comparison` },
  { category: "Browser Utilities", kind: "browser", items: `JSON Formatter and Validator|CSV Cleaner|CSV to JSON Converter|JSON to CSV Converter|Word and Character Counter|Text Case Converter|Text Diff Checker|Base64 Encoder and Decoder|URL Encoder and Decoder|UUID Generator|Markdown Previewer|HTML Entity Encoder|Timestamp Converter|Percentage Calculator|Profit Margin Calculator|UTM Link Builder|Password Generator|Text Duplicate Remover` },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const toolCatalog: ToolItem[] = groups.flatMap((group) =>
  group.items.split("|").map((name) => ({
    id: slugify(name),
    name,
    category: group.category,
    kind: group.kind,
    icon: group.category === "Browser Utilities" ? "code" : group.category === "Study & Education" ? "graduation-cap" : group.category === "Creators & Social" ? "clapperboard" : group.category === "Developer & Automation" ? "workflow" : group.category === "Business" ? "briefcase-business" : group.category === "Career & Freelancing" ? "target" : group.category === "Ecommerce & Marketing" ? "shopping-bag" : group.category === "Image, Audio & Video" ? "sparkles" : group.category === "Personal Productivity" ? "calendar-check" : "brain",
    description: group.kind === "browser" ? "Runs locally in your browser for quick, private utility tasks." : "AI-powered drafting, analysis, and file-aware assistance for focused tasks.",
  })),
);

export const browserToolIds = new Set([
  "json-formatter-and-validator", "csv-cleaner", "csv-to-json-converter", "json-to-csv-converter",
  "word-and-character-counter", "text-case-converter", "text-diff-checker", "base64-encoder-and-decoder",
  "url-encoder-and-decoder", "uuid-generator", "markdown-previewer", "html-entity-encoder",
  "timestamp-converter", "percentage-calculator", "profit-margin-calculator", "utm-link-builder",
  "password-generator", "text-duplicate-remover",
]);

export function findTool(id: string) {
  return toolCatalog.find((tool) => tool.id === id);
}
