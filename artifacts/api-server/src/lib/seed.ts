import { db, pool } from "@workspace/db";
import { companiesTable, contactsTable, contactInsightsTable } from "@workspace/db/schema";
import { sql, eq, and } from "drizzle-orm";

const COMPANIES = [
  { name: "Acme Corp", industry: "Technology", size: "201-500", location: "San Francisco, CA", country: "United States", website: "https://acme.example.com", description: "A leading technology company specializing in cloud infrastructure and developer tools.", employeeCount: 350, foundedYear: 2012, linkedinUrl: "https://linkedin.com/company/acme-corp" },
  { name: "Blue Horizon Ventures", industry: "Finance", size: "51-200", location: "New York, NY", country: "United States", website: "https://bluehorizon.example.com", description: "Venture capital and private equity firm focused on early-stage startups.", employeeCount: 120, foundedYear: 2008, linkedinUrl: "https://linkedin.com/company/blue-horizon" },
  { name: "Meridian Health", industry: "Healthcare", size: "1000+", location: "Boston, MA", country: "United States", website: "https://meridianhealth.example.com", description: "A national healthcare network providing innovative patient care solutions.", employeeCount: 8500, foundedYear: 1992, linkedinUrl: "https://linkedin.com/company/meridian-health" },
  { name: "GreenLeaf Solutions", industry: "Sustainability", size: "11-50", location: "Austin, TX", country: "United States", website: "https://greenleaf.example.com", description: "Environmental consulting and sustainability strategy for Fortune 500 companies.", employeeCount: 42, foundedYear: 2017, linkedinUrl: "https://linkedin.com/company/greenleaf-solutions" },
  { name: "Nexus Retail Group", industry: "Retail", size: "500-1000", location: "Chicago, IL", country: "United States", website: "https://nexusretail.example.com", description: "Omnichannel retail operator with brands in fashion, home goods, and electronics.", employeeCount: 780, foundedYear: 2001, linkedinUrl: "https://linkedin.com/company/nexus-retail" },
  { name: "Orbital Media", industry: "Media & Entertainment", size: "51-200", location: "Los Angeles, CA", country: "United States", website: "https://orbitalmedia.example.com", description: "Digital media company producing streaming content and interactive entertainment.", employeeCount: 175, foundedYear: 2015, linkedinUrl: "https://linkedin.com/company/orbital-media" },
  { name: "Quartz Analytics", industry: "Technology", size: "51-200", location: "Seattle, WA", country: "United States", website: "https://quartzanalytics.example.com", description: "Data analytics and AI solutions for enterprise clients across industries.", employeeCount: 165, foundedYear: 2014, linkedinUrl: "https://linkedin.com/company/quartz-analytics" },
  { name: "Spectrum Pharma", industry: "Pharmaceuticals", size: "201-500", location: "London", country: "United Kingdom", website: "https://spectrumpharma.example.com", description: "Biopharmaceutical company focused on oncology and rare disease treatments.", employeeCount: 420, foundedYear: 2005, linkedinUrl: "https://linkedin.com/company/spectrum-pharma" },
  { name: "Apex Manufacturing", industry: "Manufacturing", size: "1000+", location: "Detroit, MI", country: "United States", website: "https://apexmfg.example.com", description: "Advanced manufacturing solutions for automotive and aerospace industries.", employeeCount: 3200, foundedYear: 1978, linkedinUrl: "https://linkedin.com/company/apex-manufacturing" },
  { name: "Lighthouse Education", industry: "Education", size: "201-500", location: "Toronto", country: "Canada", website: "https://lighthouseedu.example.com", description: "EdTech platform offering professional certification and online learning.", employeeCount: 280, foundedYear: 2011, linkedinUrl: "https://linkedin.com/company/lighthouse-education" },
  { name: "Vantage Logistics", industry: "Logistics", size: "500-1000", location: "Dallas, TX", country: "United States", website: "https://vantagelogistics.example.com", description: "Supply chain management and last-mile delivery solutions.", employeeCount: 650, foundedYear: 1999, linkedinUrl: "https://linkedin.com/company/vantage-logistics" },
  { name: "Cobalt Cybersecurity", industry: "Technology", size: "11-50", location: "Washington, DC", country: "United States", website: "https://cobaltcyber.example.com", description: "Cybersecurity firm specializing in threat intelligence and incident response.", employeeCount: 38, foundedYear: 2019, linkedinUrl: "https://linkedin.com/company/cobalt-cybersecurity" },
  { name: "Pinnacle Software", industry: "Technology", size: "201-500", location: "Austin, TX", country: "United States", website: "https://pinnaclesoftware.example.com", description: "Enterprise SaaS platform for project management and team collaboration.", employeeCount: 320, foundedYear: 2013, linkedinUrl: "https://linkedin.com/company/pinnacle-software" },
  { name: "Cascade Capital", industry: "Finance", size: "11-50", location: "San Francisco, CA", country: "United States", website: "https://cascadecapital.example.com", description: "Growth equity firm investing in mid-market B2B companies.", employeeCount: 35, foundedYear: 2016, linkedinUrl: "https://linkedin.com/company/cascade-capital" },
  { name: "Solaris Energy", industry: "Energy", size: "500-1000", location: "Houston, TX", country: "United States", website: "https://solariseg.example.com", description: "Renewable energy company specializing in solar and wind farm development.", employeeCount: 740, foundedYear: 2009, linkedinUrl: "https://linkedin.com/company/solaris-energy" },
  { name: "Brightwave Marketing", industry: "Marketing & Advertising", size: "51-200", location: "New York, NY", country: "United States", website: "https://brightwave.example.com", description: "Full-service digital marketing agency specializing in performance campaigns.", employeeCount: 140, foundedYear: 2014, linkedinUrl: "https://linkedin.com/company/brightwave" },
  { name: "Titan Legal Group", industry: "Legal", size: "201-500", location: "Chicago, IL", country: "United States", website: "https://titanlegal.example.com", description: "Full-service law firm with practices in corporate, IP, and employment law.", employeeCount: 280, foundedYear: 1997, linkedinUrl: "https://linkedin.com/company/titan-legal" },
  { name: "NeuroLink AI", industry: "Technology", size: "11-50", location: "San Francisco, CA", country: "United States", website: "https://neurolinkai.example.com", description: "AI infrastructure company building next-gen model training platforms.", employeeCount: 44, foundedYear: 2021, linkedinUrl: "https://linkedin.com/company/neurolink-ai" },
  { name: "Pacific Foods Co.", industry: "Food & Beverage", size: "500-1000", location: "Portland, OR", country: "United States", website: "https://pacificfoods.example.com", description: "Organic food manufacturer distributing across North America and Asia.", employeeCount: 620, foundedYear: 2003, linkedinUrl: "https://linkedin.com/company/pacific-foods" },
  { name: "Ironclad Insurance", industry: "Insurance", size: "1000+", location: "Hartford, CT", country: "United States", website: "https://ironcladins.example.com", description: "Property and casualty insurer serving SMBs and enterprise clients.", employeeCount: 4200, foundedYear: 1984, linkedinUrl: "https://linkedin.com/company/ironclad-insurance" },
  { name: "Vivid Design Studio", industry: "Design", size: "11-50", location: "Brooklyn, NY", country: "United States", website: "https://vividstudio.example.com", description: "Award-winning UX/UI design studio working with funded startups and Fortune 500 brands.", employeeCount: 28, foundedYear: 2018, linkedinUrl: "https://linkedin.com/company/vivid-design" },
  { name: "Arctic Robotics", industry: "Manufacturing", size: "51-200", location: "Minneapolis, MN", country: "United States", website: "https://arcticrobots.example.com", description: "Industrial robotics integrator for cold-chain and food processing facilities.", employeeCount: 95, foundedYear: 2015, linkedinUrl: "https://linkedin.com/company/arctic-robotics" },
  { name: "HarbourView Real Estate", industry: "Real Estate", size: "201-500", location: "Miami, FL", country: "United States", website: "https://harbourview.example.com", description: "Commercial and residential real estate development across the Sun Belt.", employeeCount: 340, foundedYear: 2007, linkedinUrl: "https://linkedin.com/company/harbourview" },
  { name: "CloudNine HR", industry: "Human Resources", size: "51-200", location: "Denver, CO", country: "United States", website: "https://cloudninehr.example.com", description: "HR technology platform offering payroll, benefits, and compliance automation.", employeeCount: 155, foundedYear: 2016, linkedinUrl: "https://linkedin.com/company/cloudnine-hr" },
  { name: "Ember Security", industry: "Technology", size: "51-200", location: "Austin, TX", country: "United States", website: "https://embersec.example.com", description: "Cloud-native security platform for DevSecOps and container security.", employeeCount: 130, foundedYear: 2018, linkedinUrl: "https://linkedin.com/company/ember-security" },
  { name: "Verdant Agriculture", industry: "Agriculture", size: "201-500", location: "Des Moines, IA", country: "United States", website: "https://verdantagri.example.com", description: "Agtech company using precision farming and IoT sensors to optimize yields.", employeeCount: 260, foundedYear: 2011, linkedinUrl: "https://linkedin.com/company/verdant-ag" },
  { name: "Starlight Gaming", industry: "Media & Entertainment", size: "51-200", location: "Los Angeles, CA", country: "United States", website: "https://starlightgaming.example.com", description: "Independent game studio behind several critically acclaimed narrative games.", employeeCount: 80, foundedYear: 2017, linkedinUrl: "https://linkedin.com/company/starlight-gaming" },
  { name: "Quantum Diagnostics", industry: "Healthcare", size: "201-500", location: "San Diego, CA", country: "United States", website: "https://quantumdx.example.com", description: "Medical diagnostics company developing rapid test solutions for hospitals.", employeeCount: 375, foundedYear: 2010, linkedinUrl: "https://linkedin.com/company/quantum-diagnostics" },
  { name: "Redwood Analytics", industry: "Technology", size: "51-200", location: "San Francisco, CA", country: "United States", website: "https://redwoodanalytics.example.com", description: "Business intelligence and embedded analytics platform for SaaS companies.", employeeCount: 145, foundedYear: 2015, linkedinUrl: "https://linkedin.com/company/redwood-analytics" },
  { name: "Atlas Consulting", industry: "Consulting", size: "201-500", location: "Washington, DC", country: "United States", website: "https://atlasconsulting.example.com", description: "Management consulting firm focused on digital transformation and strategy.", employeeCount: 420, foundedYear: 2002, linkedinUrl: "https://linkedin.com/company/atlas-consulting" },
  { name: "Meridian Systems", industry: "Technology", size: "500-1000", location: "Seattle, WA", country: "United States", website: "https://meridiansys.example.com", description: "Enterprise software for supply chain visibility and demand forecasting.", employeeCount: 580, foundedYear: 2006, linkedinUrl: "https://linkedin.com/company/meridian-systems" },
  { name: "BlueSky Aviation", industry: "Transportation", size: "1000+", location: "Dallas, TX", country: "United States", website: "https://blueskyav.example.com", description: "Regional airline operator serving 40+ markets across North America.", employeeCount: 3800, foundedYear: 1995, linkedinUrl: "https://linkedin.com/company/bluesky-aviation" },
  { name: "Helix Biotech", industry: "Biotechnology", size: "51-200", location: "Cambridge, MA", country: "United States", website: "https://helixbiotech.example.com", description: "Biotech startup developing RNA therapeutics for rare genetic disorders.", employeeCount: 110, foundedYear: 2019, linkedinUrl: "https://linkedin.com/company/helix-biotech" },
  { name: "NovaBuild Construction", industry: "Construction", size: "201-500", location: "Phoenix, AZ", country: "United States", website: "https://novabuild.example.com", description: "Commercial construction firm specializing in data centers and healthcare facilities.", employeeCount: 385, foundedYear: 2004, linkedinUrl: "https://linkedin.com/company/novabuild" },
  { name: "Clearwave Telecom", industry: "Telecommunications", size: "1000+", location: "Atlanta, GA", country: "United States", website: "https://clearwave.example.com", description: "Fiber internet and managed services provider for enterprise customers.", employeeCount: 2900, foundedYear: 1998, linkedinUrl: "https://linkedin.com/company/clearwave" },
  { name: "Momentum Sports", industry: "Sports", size: "51-200", location: "Chicago, IL", country: "United States", website: "https://momentumsports.example.com", description: "Sports analytics and performance technology for pro and collegiate teams.", employeeCount: 85, foundedYear: 2014, linkedinUrl: "https://linkedin.com/company/momentum-sports" },
  { name: "EastBridge Bank", industry: "Finance", size: "1000+", location: "Charlotte, NC", country: "United States", website: "https://eastbridgebank.example.com", description: "Regional bank offering commercial lending and treasury management.", employeeCount: 5500, foundedYear: 1976, linkedinUrl: "https://linkedin.com/company/eastbridge-bank" },
  { name: "Volga Tech", industry: "Technology", size: "51-200", location: "Berlin", country: "Germany", website: "https://volgatech.example.com", description: "European fintech platform enabling real-time cross-border payments.", employeeCount: 120, foundedYear: 2017, linkedinUrl: "https://linkedin.com/company/volga-tech" },
  { name: "ArcLight Studios", industry: "Media & Entertainment", size: "11-50", location: "London", country: "United Kingdom", website: "https://arclightstudios.example.com", description: "Production company creating documentary and factual content for streaming platforms.", employeeCount: 42, foundedYear: 2016, linkedinUrl: "https://linkedin.com/company/arclight-studios" },
  { name: "SkyForge Defense", industry: "Defense", size: "500-1000", location: "San Antonio, TX", country: "United States", website: "https://skyforgedefense.example.com", description: "Defense contractor specializing in cybersecurity and autonomous systems.", employeeCount: 650, foundedYear: 2008, linkedinUrl: "https://linkedin.com/company/skyforge-defense" },
  { name: "Neon Commerce", industry: "E-commerce", size: "51-200", location: "Toronto", country: "Canada", website: "https://neoncommerce.example.com", description: "E-commerce enablement platform for direct-to-consumer brands.", employeeCount: 160, foundedYear: 2019, linkedinUrl: "https://linkedin.com/company/neon-commerce" },
  { name: "Terrace Hotels", industry: "Hospitality", size: "1000+", location: "Las Vegas, NV", country: "United States", website: "https://terracehotels.example.com", description: "Boutique hotel brand with 60 properties across the US and Caribbean.", employeeCount: 4700, foundedYear: 1988, linkedinUrl: "https://linkedin.com/company/terrace-hotels" },
];

const CONTACTS = [
  // Acme Corp (id 1)
  { firstName: "Sarah", lastName: "Chen", jobTitle: "Chief Technology Officer", department: "Engineering", seniority: "C-Suite", email: "sarah.chen@acme.example.com", phone: "+1 415-555-0101", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/sarah-chen", twitterHandle: "@sarahchen_tech", bio: "20-year veteran of Silicon Valley startups, passionate about scalable systems and engineering culture.", companyName: "Acme Corp" },
  { firstName: "Marcus", lastName: "Johnson", jobTitle: "VP of Product", department: "Product", seniority: "VP", email: "marcus.j@acme.example.com", phone: "+1 415-555-0102", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/marcus-johnson", bio: "Product leader with experience at Google, Stripe, and multiple startups.", companyName: "Acme Corp" },
  { firstName: "Priya", lastName: "Patel", jobTitle: "Senior Software Engineer", department: "Engineering", seniority: "Individual Contributor", email: "priya.patel@acme.example.com", phone: "+1 415-555-0103", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/priya-patel", bio: "Full-stack engineer specializing in distributed systems and real-time data pipelines.", companyName: "Acme Corp" },
  { firstName: "Ben", lastName: "Carter", jobTitle: "Marketing Manager", department: "Marketing", seniority: "Manager", email: "b.carter@acme.example.com", phone: "+1 415-555-0104", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/ben-carter", bio: "B2B marketer with focus on developer-facing content and community building.", companyName: "Acme Corp" },
  // Blue Horizon Ventures (id 2)
  { firstName: "James", lastName: "O'Brien", jobTitle: "Managing Director", department: "Investments", seniority: "C-Suite", email: "jobs@bluehorizon.example.com", phone: "+1 212-555-0201", location: "New York, NY", country: "United States", linkedinUrl: "https://linkedin.com/in/james-obrien", bio: "20+ years in venture capital. Led investments in 3 unicorn companies.", companyName: "Blue Horizon Ventures" },
  { firstName: "Elena", lastName: "Vasquez", jobTitle: "Associate Partner", department: "Investments", seniority: "Director", email: "elena.v@bluehorizon.example.com", phone: "+1 212-555-0202", location: "New York, NY", country: "United States", linkedinUrl: "https://linkedin.com/in/elena-vasquez", bio: "Fintech and SaaS investor with MBA from Wharton. Focused on Series A and B.", companyName: "Blue Horizon Ventures" },
  // Meridian Health (id 3)
  { firstName: "Robert", lastName: "Kim", jobTitle: "Chief Medical Officer", department: "Medical", seniority: "C-Suite", email: "r.kim@meridianhealth.example.com", phone: "+1 617-555-0301", location: "Boston, MA", country: "United States", linkedinUrl: "https://linkedin.com/in/dr-robert-kim", bio: "Board-certified cardiologist with 25 years of clinical experience.", companyName: "Meridian Health" },
  { firstName: "Amanda", lastName: "Torres", jobTitle: "Director of Operations", department: "Operations", seniority: "Director", email: "a.torres@meridianhealth.example.com", phone: "+1 617-555-0302", location: "Boston, MA", country: "United States", linkedinUrl: "https://linkedin.com/in/amanda-torres", bio: "Healthcare operations specialist with focus on process optimization.", companyName: "Meridian Health" },
  { firstName: "Jordan", lastName: "Bates", jobTitle: "Head of Patient Experience", department: "Operations", seniority: "Director", email: "j.bates@meridianhealth.example.com", phone: "+1 617-555-0303", location: "Boston, MA", country: "United States", linkedinUrl: "https://linkedin.com/in/jordan-bates", bio: "Improving patient outcomes through data-driven care coordination programs.", companyName: "Meridian Health" },
  // GreenLeaf Solutions (id 4)
  { firstName: "Noah", lastName: "Williams", jobTitle: "CEO & Co-Founder", department: "Executive", seniority: "C-Suite", email: "noah@greenleaf.example.com", phone: "+1 512-555-0401", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/noah-williams", twitterHandle: "@noahwilliams_green", bio: "Environmental scientist turned entrepreneur.", companyName: "GreenLeaf Solutions" },
  { firstName: "Isabella", lastName: "Rossi", jobTitle: "Sustainability Consultant", department: "Consulting", seniority: "Individual Contributor", email: "i.rossi@greenleaf.example.com", phone: "+1 512-555-0402", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/isabella-rossi", bio: "ESG reporting specialist and certified sustainability professional.", companyName: "GreenLeaf Solutions" },
  // Nexus Retail Group (id 5)
  { firstName: "David", lastName: "Park", jobTitle: "VP of Merchandising", department: "Merchandising", seniority: "VP", email: "d.park@nexusretail.example.com", phone: "+1 312-555-0501", location: "Chicago, IL", country: "United States", linkedinUrl: "https://linkedin.com/in/david-park", bio: "Retail executive with 15 years building private label brands.", companyName: "Nexus Retail Group" },
  { firstName: "Jessica", lastName: "Lee", jobTitle: "Head of E-commerce", department: "Digital", seniority: "Director", email: "j.lee@nexusretail.example.com", phone: "+1 312-555-0502", location: "Chicago, IL", country: "United States", linkedinUrl: "https://linkedin.com/in/jessica-lee", bio: "Digital commerce leader who tripled online revenue at previous roles.", companyName: "Nexus Retail Group" },
  { firstName: "Ahmed", lastName: "Hassan", jobTitle: "CFO", department: "Finance", seniority: "C-Suite", email: "a.hassan@nexusretail.example.com", phone: "+1 312-555-0503", location: "Chicago, IL", country: "United States", linkedinUrl: "https://linkedin.com/in/ahmed-hassan", bio: "Financial executive with PE background and experience leading IPO processes.", companyName: "Nexus Retail Group" },
  // Orbital Media (id 6)
  { firstName: "Tyler", lastName: "Brooks", jobTitle: "Creative Director", department: "Creative", seniority: "Director", email: "t.brooks@orbitalmedia.example.com", phone: "+1 310-555-0601", location: "Los Angeles, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/tyler-brooks", twitterHandle: "@tbrooks_creative", bio: "Emmy Award-winning creative director with experience across streaming and film.", companyName: "Orbital Media" },
  { firstName: "Maya", lastName: "Singh", jobTitle: "Head of Original Content", department: "Content", seniority: "Director", email: "m.singh@orbitalmedia.example.com", phone: "+1 310-555-0602", location: "Los Angeles, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/maya-singh", bio: "Former Netflix content acquisition manager. Expert in narrative content strategy.", companyName: "Orbital Media" },
  // Quartz Analytics (id 7)
  { firstName: "Sophia", lastName: "Martinez", jobTitle: "Data Scientist", department: "Data", seniority: "Individual Contributor", email: "s.martinez@quartzanalytics.example.com", phone: "+1 206-555-0701", location: "Seattle, WA", country: "United States", linkedinUrl: "https://linkedin.com/in/sophia-martinez", bio: "ML engineer with focus on NLP and predictive analytics. PhD from UW.", companyName: "Quartz Analytics" },
  { firstName: "Liam", lastName: "Thompson", jobTitle: "VP of Sales", department: "Sales", seniority: "VP", email: "l.thompson@quartzanalytics.example.com", phone: "+1 206-555-0702", location: "Seattle, WA", country: "United States", linkedinUrl: "https://linkedin.com/in/liam-thompson", bio: "Enterprise sales leader who has closed $50M+ in ARR.", companyName: "Quartz Analytics" },
  { firstName: "Hannah", lastName: "White", jobTitle: "Product Manager", department: "Product", seniority: "Individual Contributor", email: "h.white@quartzanalytics.example.com", phone: "+1 206-555-0703", location: "Seattle, WA", country: "United States", linkedinUrl: "https://linkedin.com/in/hannah-white", bio: "Product manager passionate about data democratization and self-service analytics.", companyName: "Quartz Analytics" },
  // Spectrum Pharma (id 8)
  { firstName: "Catherine", lastName: "Hughes", jobTitle: "Chief Scientific Officer", department: "R&D", seniority: "C-Suite", email: "c.hughes@spectrumpharma.example.com", phone: "+44 20 7946 0601", location: "London", country: "United Kingdom", linkedinUrl: "https://linkedin.com/in/dr-catherine-hughes", bio: "Oncologist and researcher with 30 patents in targeted therapy.", companyName: "Spectrum Pharma" },
  { firstName: "Oliver", lastName: "Whitmore", jobTitle: "VP of Clinical Affairs", department: "Clinical", seniority: "VP", email: "o.whitmore@spectrumpharma.example.com", phone: "+44 20 7946 0602", location: "London", country: "United Kingdom", linkedinUrl: "https://linkedin.com/in/oliver-whitmore", bio: "Led clinical programs from Phase I through approval at three biotech firms.", companyName: "Spectrum Pharma" },
  // Apex Manufacturing (id 9)
  { firstName: "William", lastName: "Foster", jobTitle: "VP of Engineering", department: "Engineering", seniority: "VP", email: "w.foster@apexmfg.example.com", phone: "+1 313-555-0901", location: "Detroit, MI", country: "United States", linkedinUrl: "https://linkedin.com/in/william-foster", bio: "Manufacturing engineer specializing in automation and Industry 4.0.", companyName: "Apex Manufacturing" },
  { firstName: "Rachel", lastName: "Green", jobTitle: "Plant Manager", department: "Operations", seniority: "Manager", email: "r.green@apexmfg.example.com", phone: "+1 313-555-0902", location: "Detroit, MI", country: "United States", linkedinUrl: "https://linkedin.com/in/rachel-green", bio: "Operations leader managing a 500-person facility producing 10,000 units per day.", companyName: "Apex Manufacturing" },
  // Lighthouse Education (id 10)
  { firstName: "Michael", lastName: "Scott", jobTitle: "Director of Curriculum", department: "Education", seniority: "Director", email: "m.scott@lighthouseedu.example.com", phone: "+1 416-555-1001", location: "Toronto", country: "Canada", linkedinUrl: "https://linkedin.com/in/michael-scott-edu", bio: "Curriculum designer with expertise in adult learning and professional development.", companyName: "Lighthouse Education" },
  { firstName: "Karen", lastName: "Walsh", jobTitle: "Head of Growth", department: "Marketing", seniority: "Director", email: "k.walsh@lighthouseedu.example.com", phone: "+1 416-555-1002", location: "Toronto", country: "Canada", linkedinUrl: "https://linkedin.com/in/karen-walsh", bio: "Growth marketer who scaled a SaaS platform from 10K to 500K users.", companyName: "Lighthouse Education" },
  // Vantage Logistics (id 11)
  { firstName: "Carlos", lastName: "Rivera", jobTitle: "VP of Operations", department: "Operations", seniority: "VP", email: "c.rivera@vantagelogistics.example.com", phone: "+1 972-555-1101", location: "Dallas, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/carlos-rivera", bio: "Supply chain expert with 18 years optimizing last-mile delivery networks.", companyName: "Vantage Logistics" },
  // Cobalt Cybersecurity (id 12)
  { firstName: "Aisha", lastName: "Okafor", jobTitle: "CISO", department: "Security", seniority: "C-Suite", email: "a.okafor@cobaltcyber.example.com", phone: "+1 202-555-1201", location: "Washington, DC", country: "United States", linkedinUrl: "https://linkedin.com/in/aisha-okafor", bio: "Former NSA analyst. Expert in threat modeling and zero-trust architecture.", companyName: "Cobalt Cybersecurity" },
  { firstName: "Derek", lastName: "Huang", jobTitle: "Senior Security Engineer", department: "Security", seniority: "Individual Contributor", email: "d.huang@cobaltcyber.example.com", phone: "+1 202-555-1202", location: "Washington, DC", country: "United States", linkedinUrl: "https://linkedin.com/in/derek-huang", bio: "Red team specialist with expertise in cloud penetration testing.", companyName: "Cobalt Cybersecurity" },
  // Pinnacle Software (id 13)
  { firstName: "Natalie", lastName: "Brooks", jobTitle: "CEO", department: "Executive", seniority: "C-Suite", email: "n.brooks@pinnaclesoftware.example.com", phone: "+1 512-555-1301", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/natalie-brooks", twitterHandle: "@natbrooks_ceo", bio: "Serial entrepreneur. Founded two SaaS companies acquired by public companies.", companyName: "Pinnacle Software" },
  { firstName: "Ethan", lastName: "Rivera", jobTitle: "Head of Engineering", department: "Engineering", seniority: "Director", email: "e.rivera@pinnaclesoftware.example.com", phone: "+1 512-555-1302", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/ethan-rivera", bio: "Engineering leader building high-performance distributed systems.", companyName: "Pinnacle Software" },
  { firstName: "Grace", lastName: "Liu", jobTitle: "Product Designer", department: "Design", seniority: "Individual Contributor", email: "g.liu@pinnaclesoftware.example.com", phone: "+1 512-555-1303", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/grace-liu", bio: "UX designer passionate about simplifying complex enterprise workflows.", companyName: "Pinnacle Software" },
  // Cascade Capital (id 14)
  { firstName: "Victor", lastName: "Zhao", jobTitle: "General Partner", department: "Investments", seniority: "C-Suite", email: "v.zhao@cascadecapital.example.com", phone: "+1 415-555-1401", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/victor-zhao", bio: "Former McKinsey partner turned investor. Focus on B2B SaaS and fintech.", companyName: "Cascade Capital" },
  { firstName: "Simone", lastName: "Dupont", jobTitle: "Principal", department: "Investments", seniority: "Director", email: "s.dupont@cascadecapital.example.com", phone: "+1 415-555-1402", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/simone-dupont", bio: "Invested in 12 companies, 3 exits. Former operator at Stripe and Plaid.", companyName: "Cascade Capital" },
  // Solaris Energy (id 15)
  { firstName: "Andre", lastName: "Jefferson", jobTitle: "COO", department: "Operations", seniority: "C-Suite", email: "a.jefferson@solariseg.example.com", phone: "+1 713-555-1501", location: "Houston, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/andre-jefferson", bio: "Energy executive with 20 years in project development across oil and renewable sectors.", companyName: "Solaris Energy" },
  { firstName: "Mei", lastName: "Zhang", jobTitle: "Director of Project Finance", department: "Finance", seniority: "Director", email: "m.zhang@solariseg.example.com", phone: "+1 713-555-1502", location: "Houston, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/mei-zhang", bio: "Structured $2B+ in project finance transactions for solar and wind assets.", companyName: "Solaris Energy" },
  // Brightwave Marketing (id 16)
  { firstName: "Leo", lastName: "Moretti", jobTitle: "Chief Creative Officer", department: "Creative", seniority: "C-Suite", email: "l.moretti@brightwave.example.com", phone: "+1 212-555-1601", location: "New York, NY", country: "United States", linkedinUrl: "https://linkedin.com/in/leo-moretti", bio: "Award-winning creative director with campaigns for 40+ global brands.", companyName: "Brightwave Marketing" },
  { firstName: "Zara", lastName: "Ahmed", jobTitle: "Performance Marketing Manager", department: "Marketing", seniority: "Manager", email: "z.ahmed@brightwave.example.com", phone: "+1 212-555-1602", location: "New York, NY", country: "United States", linkedinUrl: "https://linkedin.com/in/zara-ahmed", bio: "Paid media expert specializing in Google and Meta advertising at scale.", companyName: "Brightwave Marketing" },
  // Titan Legal Group (id 17)
  { firstName: "Patricia", lastName: "Monroe", jobTitle: "Managing Partner", department: "Legal", seniority: "C-Suite", email: "p.monroe@titanlegal.example.com", phone: "+1 312-555-1701", location: "Chicago, IL", country: "United States", linkedinUrl: "https://linkedin.com/in/patricia-monroe", bio: "Corporate and M&A attorney with 25 years advising on complex transactions.", companyName: "Titan Legal Group" },
  { firstName: "Joshua", lastName: "Stern", jobTitle: "Partner, IP", department: "Legal", seniority: "Director", email: "j.stern@titanlegal.example.com", phone: "+1 312-555-1702", location: "Chicago, IL", country: "United States", linkedinUrl: "https://linkedin.com/in/joshua-stern", bio: "Intellectual property attorney specializing in tech patents and trade secrets.", companyName: "Titan Legal Group" },
  // NeuroLink AI (id 18)
  { firstName: "Ren", lastName: "Tanaka", jobTitle: "CTO & Co-Founder", department: "Engineering", seniority: "C-Suite", email: "r.tanaka@neurolinkai.example.com", phone: "+1 415-555-1801", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/ren-tanaka", twitterHandle: "@rentanaka_ai", bio: "Former DeepMind researcher. Building the infrastructure layer for frontier AI models.", companyName: "NeuroLink AI" },
  { firstName: "Chloe", lastName: "Park", jobTitle: "ML Research Engineer", department: "Research", seniority: "Individual Contributor", email: "c.park@neurolinkai.example.com", phone: "+1 415-555-1802", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/chloe-park", bio: "PhD from Stanford AI Lab. Expert in transformer optimization and efficient inference.", companyName: "NeuroLink AI" },
  // Ironclad Insurance (id 20)
  { firstName: "Gregory", lastName: "Hall", jobTitle: "Chief Underwriting Officer", department: "Underwriting", seniority: "C-Suite", email: "g.hall@ironcladins.example.com", phone: "+1 860-555-2001", location: "Hartford, CT", country: "United States", linkedinUrl: "https://linkedin.com/in/gregory-hall", bio: "30-year insurance veteran. Led the launch of a commercial lines digital platform.", companyName: "Ironclad Insurance" },
  { firstName: "Tina", lastName: "Kowalski", jobTitle: "VP of Claims", department: "Claims", seniority: "VP", email: "t.kowalski@ironcladins.example.com", phone: "+1 860-555-2002", location: "Hartford, CT", country: "United States", linkedinUrl: "https://linkedin.com/in/tina-kowalski", bio: "Claims leader managing a team of 200+ adjusters across 12 regional offices.", companyName: "Ironclad Insurance" },
  // Vivid Design Studio (id 21)
  { firstName: "Sam", lastName: "Adeyemi", jobTitle: "Founder & Principal Designer", department: "Design", seniority: "C-Suite", email: "sam@vividstudio.example.com", phone: "+1 718-555-2101", location: "Brooklyn, NY", country: "United States", linkedinUrl: "https://linkedin.com/in/sam-adeyemi", twitterHandle: "@samadeyemi_ux", bio: "Product design veteran who has shipped work for Airbnb, Facebook, and IBM.", companyName: "Vivid Design Studio" },
  // HarbourView Real Estate (id 23)
  { firstName: "Diana", lastName: "Santos", jobTitle: "Chief Investment Officer", department: "Investments", seniority: "C-Suite", email: "d.santos@harbourview.example.com", phone: "+1 305-555-2301", location: "Miami, FL", country: "United States", linkedinUrl: "https://linkedin.com/in/diana-santos", bio: "Real estate investor with $1.2B in assets under management across commercial portfolios.", companyName: "HarbourView Real Estate" },
  { firstName: "Marco", lastName: "Reyes", jobTitle: "Development Manager", department: "Development", seniority: "Manager", email: "m.reyes@harbourview.example.com", phone: "+1 305-555-2302", location: "Miami, FL", country: "United States", linkedinUrl: "https://linkedin.com/in/marco-reyes", bio: "Managed $400M+ in ground-up construction projects across Florida and Texas.", companyName: "HarbourView Real Estate" },
  // CloudNine HR (id 24)
  { firstName: "Fiona", lastName: "Gallagher", jobTitle: "CEO", department: "Executive", seniority: "C-Suite", email: "f.gallagher@cloudninehr.example.com", phone: "+1 303-555-2401", location: "Denver, CO", country: "United States", linkedinUrl: "https://linkedin.com/in/fiona-gallagher", bio: "HR tech founder building the next generation of workforce management tools.", companyName: "CloudNine HR" },
  { firstName: "Theo", lastName: "Anderson", jobTitle: "Head of Customer Success", department: "Customer Success", seniority: "Director", email: "t.anderson@cloudninehr.example.com", phone: "+1 303-555-2402", location: "Denver, CO", country: "United States", linkedinUrl: "https://linkedin.com/in/theo-anderson", bio: "Built and scaled CS teams at three HR SaaS companies from 0 to enterprise.", companyName: "CloudNine HR" },
  // Ember Security (id 25)
  { firstName: "Ivan", lastName: "Petrov", jobTitle: "VP of Engineering", department: "Engineering", seniority: "VP", email: "i.petrov@embersec.example.com", phone: "+1 512-555-2501", location: "Austin, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/ivan-petrov", bio: "Security engineer who built cloud-native SIEM platforms at two acquired startups.", companyName: "Ember Security" },
  // Verdant Agriculture (id 26)
  { firstName: "Laura", lastName: "Chen", jobTitle: "Chief Agronomist", department: "Research", seniority: "Director", email: "l.chen@verdantagri.example.com", phone: "+1 515-555-2601", location: "Des Moines, IA", country: "United States", linkedinUrl: "https://linkedin.com/in/laura-chen", bio: "Agronomist and data scientist developing precision farming models for row crops.", companyName: "Verdant Agriculture" },
  // Starlight Gaming (id 27)
  { firstName: "Felix", lastName: "Nguyen", jobTitle: "Game Director", department: "Creative", seniority: "Director", email: "f.nguyen@starlightgaming.example.com", phone: "+1 310-555-2701", location: "Los Angeles, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/felix-nguyen", bio: "BAFTA-nominated game director known for boundary-pushing narrative experiences.", companyName: "Starlight Gaming" },
  { firstName: "Amber", lastName: "Collins", jobTitle: "Lead Programmer", department: "Engineering", seniority: "Individual Contributor", email: "a.collins@starlightgaming.example.com", phone: "+1 310-555-2702", location: "Los Angeles, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/amber-collins", bio: "Engine programmer specializing in Unreal Engine and procedural generation.", companyName: "Starlight Gaming" },
  // Quantum Diagnostics (id 28)
  { firstName: "Dr. Richard", lastName: "Nakamura", jobTitle: "CEO", department: "Executive", seniority: "C-Suite", email: "r.nakamura@quantumdx.example.com", phone: "+1 619-555-2801", location: "San Diego, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/richard-nakamura", bio: "Physician scientist and entrepreneur with two successful diagnostics exits.", companyName: "Quantum Diagnostics" },
  // Redwood Analytics (id 29)
  { firstName: "Jasmine", lastName: "Ford", jobTitle: "VP of Engineering", department: "Engineering", seniority: "VP", email: "j.ford@redwoodanalytics.example.com", phone: "+1 415-555-2901", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/jasmine-ford", bio: "Full-stack engineering leader who has scaled teams from 5 to 60+ engineers.", companyName: "Redwood Analytics" },
  { firstName: "Patrick", lastName: "O'Connor", jobTitle: "Sales Engineer", department: "Sales", seniority: "Individual Contributor", email: "p.oconnor@redwoodanalytics.example.com", phone: "+1 415-555-2902", location: "San Francisco, CA", country: "United States", linkedinUrl: "https://linkedin.com/in/patrick-oconnor", bio: "Bridges the gap between technical depth and enterprise sales cycles.", companyName: "Redwood Analytics" },
  // Atlas Consulting (id 30)
  { firstName: "Danielle", lastName: "Wright", jobTitle: "Managing Director", department: "Consulting", seniority: "C-Suite", email: "d.wright@atlasconsulting.example.com", phone: "+1 202-555-3001", location: "Washington, DC", country: "United States", linkedinUrl: "https://linkedin.com/in/danielle-wright", bio: "Digital strategy consultant. Former partner at Deloitte with 22 years of experience.", companyName: "Atlas Consulting" },
  { firstName: "Connor", lastName: "Burke", jobTitle: "Senior Consultant", department: "Consulting", seniority: "Individual Contributor", email: "c.burke@atlasconsulting.example.com", phone: "+1 202-555-3002", location: "Washington, DC", country: "United States", linkedinUrl: "https://linkedin.com/in/connor-burke", bio: "Transformation consultant specializing in cloud migration and operating model design.", companyName: "Atlas Consulting" },
  // Meridian Systems (id 31)
  { firstName: "Helen", lastName: "Morrison", jobTitle: "Chief Product Officer", department: "Product", seniority: "C-Suite", email: "h.morrison@meridiansys.example.com", phone: "+1 206-555-3101", location: "Seattle, WA", country: "United States", linkedinUrl: "https://linkedin.com/in/helen-morrison", bio: "CPO with deep expertise in supply chain software and vertical SaaS platforms.", companyName: "Meridian Systems" },
  // BlueSky Aviation (id 32)
  { firstName: "Captain Thomas", lastName: "Reid", jobTitle: "VP of Flight Operations", department: "Operations", seniority: "VP", email: "t.reid@blueskyav.example.com", phone: "+1 972-555-3201", location: "Dallas, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/thomas-reid", bio: "28-year aviation career as commercial pilot and operations executive.", companyName: "BlueSky Aviation" },
  { firstName: "Sandra", lastName: "Miles", jobTitle: "Director of Customer Experience", department: "Customer Experience", seniority: "Director", email: "s.miles@blueskyav.example.com", phone: "+1 972-555-3202", location: "Dallas, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/sandra-miles", bio: "Airline customer experience leader passionate about reducing friction at every touchpoint.", companyName: "BlueSky Aviation" },
  // Helix Biotech (id 33)
  { firstName: "Dr. Ananya", lastName: "Krishnan", jobTitle: "CEO & Co-Founder", department: "Executive", seniority: "C-Suite", email: "a.krishnan@helixbiotech.example.com", phone: "+1 617-555-3301", location: "Cambridge, MA", country: "United States", linkedinUrl: "https://linkedin.com/in/ananya-krishnan", bio: "Molecular biologist and entrepreneur. PI at MIT before founding Helix.", companyName: "Helix Biotech" },
  { firstName: "Marcus", lastName: "Webb", jobTitle: "VP of Business Development", department: "Business Development", seniority: "VP", email: "m.webb@helixbiotech.example.com", phone: "+1 617-555-3302", location: "Cambridge, MA", country: "United States", linkedinUrl: "https://linkedin.com/in/marcus-webb", bio: "Negotiated 8 pharma partnerships. Former BD lead at Moderna.", companyName: "Helix Biotech" },
  // Clearwave Telecom (id 35)
  { firstName: "Calvin", lastName: "Reeves", jobTitle: "CTO", department: "Engineering", seniority: "C-Suite", email: "c.reeves@clearwave.example.com", phone: "+1 404-555-3501", location: "Atlanta, GA", country: "United States", linkedinUrl: "https://linkedin.com/in/calvin-reeves", bio: "Telecom engineer who architected fiber networks serving 500,000+ subscribers.", companyName: "Clearwave Telecom" },
  { firstName: "Angela", lastName: "Moss", jobTitle: "VP of Enterprise Sales", department: "Sales", seniority: "VP", email: "a.moss@clearwave.example.com", phone: "+1 404-555-3502", location: "Atlanta, GA", country: "United States", linkedinUrl: "https://linkedin.com/in/angela-moss", bio: "Closed $120M in enterprise contracts. Expert in managed services and SD-WAN sales.", companyName: "Clearwave Telecom" },
  // EastBridge Bank (id 37)
  { firstName: "Richard", lastName: "Chandler", jobTitle: "Chairman & CEO", department: "Executive", seniority: "C-Suite", email: "r.chandler@eastbridgebank.example.com", phone: "+1 704-555-3701", location: "Charlotte, NC", country: "United States", linkedinUrl: "https://linkedin.com/in/richard-chandler", bio: "35-year banking career. Led EastBridge through two recessions and a successful merger.", companyName: "EastBridge Bank" },
  { firstName: "Christine", lastName: "Park", jobTitle: "Chief Risk Officer", department: "Risk", seniority: "C-Suite", email: "c.park@eastbridgebank.example.com", phone: "+1 704-555-3702", location: "Charlotte, NC", country: "United States", linkedinUrl: "https://linkedin.com/in/christine-park-crm", bio: "Risk management executive with expertise in credit, market, and operational risk.", companyName: "EastBridge Bank" },
  // Volga Tech (id 38)
  { firstName: "Alexei", lastName: "Sorokin", jobTitle: "CTO", department: "Engineering", seniority: "C-Suite", email: "a.sorokin@volgatech.example.com", phone: "+49 30 555 3801", location: "Berlin", country: "Germany", linkedinUrl: "https://linkedin.com/in/alexei-sorokin", bio: "Payments infrastructure architect. Built real-time settlement systems handling $5B/day.", companyName: "Volga Tech" },
  { firstName: "Lena", lastName: "Fischer", jobTitle: "Head of Compliance", department: "Legal", seniority: "Director", email: "l.fischer@volgatech.example.com", phone: "+49 30 555 3802", location: "Berlin", country: "Germany", linkedinUrl: "https://linkedin.com/in/lena-fischer", bio: "Fintech compliance expert. Navigated PSD2 and GDPR implementation for 3 fintechs.", companyName: "Volga Tech" },
  // ArcLight Studios (id 39)
  { firstName: "James", lastName: "Harper", jobTitle: "Executive Producer", department: "Production", seniority: "Director", email: "j.harper@arclightstudios.example.com", phone: "+44 20 7946 3901", location: "London", country: "United Kingdom", linkedinUrl: "https://linkedin.com/in/james-harper-ep", bio: "BAFTA and Emmy-winning documentary producer with 15 films in distribution.", companyName: "ArcLight Studios" },
  // SkyForge Defense (id 40)
  { firstName: "Colonel Michael", lastName: "Barnes", jobTitle: "VP of Defense Programs", department: "Programs", seniority: "VP", email: "m.barnes@skyforgedefense.example.com", phone: "+1 210-555-4001", location: "San Antonio, TX", country: "United States", linkedinUrl: "https://linkedin.com/in/michael-barnes-def", bio: "Retired Army Colonel with 25 years in cybersecurity and autonomous systems programs.", companyName: "SkyForge Defense" },
  // Neon Commerce (id 41)
  { firstName: "Alicia", lastName: "Kim", jobTitle: "VP of Product", department: "Product", seniority: "VP", email: "a.kim@neoncommerce.example.com", phone: "+1 647-555-4101", location: "Toronto", country: "Canada", linkedinUrl: "https://linkedin.com/in/alicia-kim", bio: "E-commerce product veteran who has built checkout and fulfillment platforms from scratch.", companyName: "Neon Commerce" },
  { firstName: "Raj", lastName: "Pillai", jobTitle: "Head of Engineering", department: "Engineering", seniority: "Director", email: "r.pillai@neoncommerce.example.com", phone: "+1 647-555-4102", location: "Toronto", country: "Canada", linkedinUrl: "https://linkedin.com/in/raj-pillai", bio: "Distributed systems engineer. Built order management systems processing 50K orders/day.", companyName: "Neon Commerce" },
  // Terrace Hotels (id 42)
  { firstName: "Vivienne", lastName: "Laurent", jobTitle: "Chief Brand Officer", department: "Marketing", seniority: "C-Suite", email: "v.laurent@terracehotels.example.com", phone: "+1 702-555-4201", location: "Las Vegas, NV", country: "United States", linkedinUrl: "https://linkedin.com/in/vivienne-laurent", bio: "Luxury hospitality marketing executive. Rebranded 3 boutique hotel groups.", companyName: "Terrace Hotels" },
  { firstName: "Samuel", lastName: "Knight", jobTitle: "VP of Revenue Management", department: "Revenue", seniority: "VP", email: "s.knight@terracehotels.example.com", phone: "+1 702-555-4202", location: "Las Vegas, NV", country: "United States", linkedinUrl: "https://linkedin.com/in/samuel-knight", bio: "Hospitality revenue strategist who increased RevPAR by 23% across the portfolio.", companyName: "Terrace Hotels" },
];

const INSIGHTS_BY_NAME: Array<{
  firstName: string;
  lastName: string;
  insights: Array<{
    title: string;
    url: string;
    source: string;
    mediaType: string;
    description: string;
    publishedDate: string;
  }>;
}> = [
  {
    firstName: "Sarah",
    lastName: "Chen",
    insights: [
      { title: "Women in Tech Leadership: Sarah Chen on Building Scalable Engineering Teams", url: "https://techcrunch.com/2024/03/15/women-in-tech-leadership-engineering-teams", source: "TechCrunch", mediaType: "article", description: "Sarah Chen, CTO of Acme Corp, shares how she grew her engineering organization from 12 to 80 engineers in under two years while maintaining a culture of psychological safety and continuous delivery.", publishedDate: "Mar 2024" },
      { title: "Why We Moved to a Platform Team Model (And What We Learned)", url: "https://medium.com/@sarah-chen-cto/platform-team-model-lessons", source: "Medium", mediaType: "blog_post", description: "A candid post-mortem on Acme's shift to a platform team structure — what worked, what didn't, and the three things Sarah wishes she had known before starting the transformation.", publishedDate: "Aug 2023" },
      { title: "AI-Assisted Code Review: My Team's 6-Month Experiment", url: "https://www.linkedin.com/pulse/ai-assisted-code-review-sarah-chen", source: "LinkedIn", mediaType: "linkedin_post", description: "Sarah's viral LinkedIn article documenting Acme's experiment with AI code review tools, covering productivity gains, false positives, and the surprising impact on junior developer growth.", publishedDate: "Dec 2023" },
      { title: "Engineering Leadership Podcast — Ep. 214: From IC to CTO in 8 Years", url: "https://open.spotify.com/episode/2x7KqLmVgRpFzX8N3YdWqA", source: "Spotify", mediaType: "podcast", description: "Sarah joins host Charity Majors to discuss her path from individual contributor to CTO, how she thinks about technical debt, and why she believes empathy is the most underrated engineering skill.", publishedDate: "Jan 2024" },
      { title: "The Stack Overflow Podcast — Building for Developers, Not Just Users", url: "https://stackoverflow.blog/podcast/building-for-developers", source: "Stack Overflow Blog", mediaType: "podcast", description: "In this episode, Sarah discusses developer experience as a first-class product concern, internal tooling investment strategies, and why she prioritizes documentation as a leadership signal.", publishedDate: "Sep 2023" },
      { title: "Forbes 30 Under 40: Technology Leaders Shaping the Future", url: "https://www.forbes.com/lists/technology-leaders-under-40/", source: "Forbes", mediaType: "press_release", description: "Sarah Chen was named to Forbes' inaugural 30 Under 40 list in the Technology category, recognized for her technical vision and for championing diversity initiatives across Acme's engineering organization.", publishedDate: "Feb 2024" },
      { title: "The Future of Platform Engineering — Keynote at QCon San Francisco", url: "https://www.youtube.com/watch?v=xK9mJ8qPlE4", source: "YouTube", mediaType: "video", description: "Sarah's keynote at QCon San Francisco where she walks through Acme's platform evolution, microservices migration, and the developer experience initiatives that cut deployment time by 70%.", publishedDate: "Oct 2023" },
      { title: "SREcon Americas 2023 — Panel: Reliability at Scale Without Burning Out Your Team", url: "https://www.youtube.com/watch?v=rP2mNqX7vTs", source: "YouTube", mediaType: "video", description: "Sarah joins a panel of senior SREs to debate on-call culture, incident response best practices, and how to maintain reliability without sacrificing engineer wellbeing.", publishedDate: "Mar 2023" },
    ],
  },
  {
    firstName: "Priya",
    lastName: "Patel",
    insights: [
      { title: "How I Scaled Acme's Infrastructure to Handle 10x Traffic Without Downtime", url: "https://techcrunch.com/2024/01/22/acme-infrastructure-scale-priya-patel", source: "TechCrunch", mediaType: "article", description: "Priya Patel details the architectural decisions and engineering trade-offs that enabled Acme Corp to absorb a 10x traffic spike during their biggest product launch — including the late-night incident that almost derailed everything.", publishedDate: "Jan 2024" },
      { title: "Rust in Production: Lessons from Rewriting Our Core API", url: "https://medium.com/@priya-patel-eng/rust-in-production-core-api-rewrite", source: "Medium", mediaType: "blog_post", description: "After 18 months of gradual migration, Priya shares what the team learned rewriting Acme's core API in Rust — performance wins, memory safety surprises, and the cultural shift required to get a team of Go engineers to embrace a new language.", publishedDate: "Nov 2023" },
      { title: "The hidden cost of \"good enough\" observability — a $200k wake-up call", url: "https://www.linkedin.com/pulse/hidden-cost-observability-priya-patel", source: "LinkedIn", mediaType: "linkedin_post", description: "Priya's most-shared LinkedIn post, recounting how an under-instrumented service led to a prolonged outage and quantifying exactly what the team learned — and changed — as a result. 4,200 reactions and counting.", publishedDate: "Oct 2023" },
      { title: "Software Engineering Daily — Building Reliable Systems with Priya Patel", url: "https://open.spotify.com/episode/4kNpXqRmVgTfYz2N8WdBqC", source: "Spotify", mediaType: "podcast", description: "Priya joins the Software Engineering Daily podcast to talk about chaos engineering, on-call culture, and why she believes every engineer should spend time in production support before moving to greenfield work.", publishedDate: "Mar 2024" },
      { title: "Acme Corp Names Priya Patel as Engineering Innovator of the Year", url: "https://www.businesswire.com/news/acme-corp-engineering-innovator-2024", source: "Business Wire", mediaType: "press_release", description: "Acme Corp announces Priya Patel as its inaugural Engineering Innovator of the Year, recognizing her contributions to platform reliability, developer tooling, and her open-source work on the team's distributed tracing library.", publishedDate: "Feb 2024" },
      { title: "Strange Loop 2023 — Distributed Systems at the Edge: Lessons from the Field", url: "https://www.youtube.com/watch?v=hT4qR9mKzLw", source: "YouTube", mediaType: "video", description: "Priya's talk at Strange Loop walks through real-world distributed systems failures at Acme, the debugging techniques that uncovered them, and the observability stack her team built to prevent recurrence.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Marcus", lastName: "Johnson",
    insights: [
      { title: "What Product Leaders Get Wrong About Roadmaps", url: "https://www.lennysnewsletter.com/p/product-roadmaps-marcus-johnson", source: "Lenny's Newsletter", mediaType: "article", description: "Marcus argues that most roadmaps are waterfall planning in disguise — and lays out the lightweight, outcome-driven approach Acme uses to stay adaptive without losing stakeholder alignment.", publishedDate: "Feb 2024" },
      { title: "Mind the Product San Francisco — Discovery at Scale", url: "https://www.youtube.com/watch?v=mP3qRxKv7aB", source: "YouTube", mediaType: "video", description: "Marcus's keynote on how Acme runs continuous discovery across a 12-person product team, balancing qualitative interviews with quantitative signals to prioritize what actually moves the needle.", publishedDate: "Nov 2023" },
      { title: "The \"Jobs to Be Done\" framework saved our Q4 roadmap (here's how)", url: "https://www.linkedin.com/posts/marcus-johnson-acme", source: "LinkedIn", mediaType: "linkedin_post", description: "A thread Marcus posted after Acme's Q4 planning, walking through how JTBD interviews uncovered a customer segment they were completely ignoring — and the feature that came out of it.", publishedDate: "Jan 2024" },
      { title: "Six Months with AI-Assisted Prioritization: What Worked, What Didn't", url: "https://medium.com/@marcusjohnson/ai-prioritization-retrospective", source: "Medium", mediaType: "blog_post", description: "An honest retrospective on Acme's pilot of AI tooling for backlog prioritization — where it genuinely helped PMs, where it introduced bias, and why the team ultimately kept a human in the loop.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "James", lastName: "O'Brien",
    insights: [
      { title: "The Founder-Investor Relationship No One Talks About", url: "https://techcrunch.com/2024/02/08/founder-investor-relationship-james-obrien", source: "TechCrunch", mediaType: "article", description: "James O'Brien shares what 20 years of venture investing has taught him about trust, transparency, and the moments when boards either help or hurt the companies they back.", publishedDate: "Feb 2024" },
      { title: "Blue Horizon Ventures Closes $280M Fund IV to Back Pre-Seed and Seed B2B Startups", url: "https://www.businesswire.com/news/blue-horizon-fund-iv-close", source: "Business Wire", mediaType: "press_release", description: "Blue Horizon Ventures announces the close of its oversubscribed Fund IV, with commitments from top-tier institutional LPs. Managing Director James O'Brien will lead deal flow for enterprise software and fintech.", publishedDate: "Mar 2024" },
      { title: "Invest Like the Best — Ep. 312: Pattern Recognition in Early-Stage Investing", url: "https://open.spotify.com/episode/9kQpNrWxVsRfAb3M7YcDpH", source: "Spotify", mediaType: "podcast", description: "James joins Patrick O'Shaughnessy to discuss how he evaluates pre-seed teams, what early signals predict durable companies versus flash-in-the-pan traction, and the three investments he wishes he had passed on.", publishedDate: "Dec 2023" },
      { title: "SaaStr Annual 2023 — The VC Perspective: What Separates the Top 10% of Founders", url: "https://www.youtube.com/watch?v=nQ8mRyWzXpK", source: "YouTube", mediaType: "video", description: "James speaks on a panel of early-stage investors discussing the founder traits that correlate with outsized outcomes — including one counterintuitive signal he has used for the past decade.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Elena", lastName: "Vasquez",
    insights: [
      { title: "Why Fintech Valuations Are Finally Making Sense Again", url: "https://fortune.com/2024/01/15/fintech-valuations-reset-elena-vasquez", source: "Fortune", mediaType: "article", description: "Elena Vasquez of Blue Horizon analyzes the post-2021 fintech correction, which companies are emerging stronger, and what the reset means for founders raising Series A in 2024.", publishedDate: "Jan 2024" },
      { title: "Hot take: the \"founder-market fit\" obsession is causing us to miss great companies", url: "https://www.linkedin.com/pulse/founder-market-fit-elena-vasquez", source: "LinkedIn", mediaType: "linkedin_post", description: "Elena's widely shared LinkedIn post arguing that VCs overweight founder background and underweight distribution insight — with three portfolio examples to back it up.", publishedDate: "Nov 2023" },
      { title: "Due Diligence Checklist for SaaS Series A: What We Actually Look At", url: "https://medium.com/@elena-vasquez-vc/series-a-due-diligence", source: "Medium", mediaType: "blog_post", description: "A practical breakdown of Blue Horizon's evaluation framework for SaaS Series A deals — from cohort retention analysis to team reference calls — written for founders who want to know what's coming.", publishedDate: "Aug 2023" },
    ],
  },
  {
    firstName: "Robert", lastName: "Kim",
    insights: [
      { title: "Rethinking Cardiac Care Pathways in a Post-Pandemic Health System", url: "https://jamanetwork.com/journals/jama/2024/cardiac-care-robert-kim", source: "JAMA", mediaType: "article", description: "Dr. Kim's peer-reviewed perspective on how COVID-19 exposed structural weaknesses in US cardiology referral networks, and the care coordination models Meridian Health has implemented to close the gaps.", publishedDate: "Mar 2024" },
      { title: "Meridian Health Achieves Top-Decile Patient Satisfaction Scores for Third Consecutive Year", url: "https://www.prnewswire.com/meridian-health-patient-satisfaction-2024", source: "PR Newswire", mediaType: "press_release", description: "Meridian Health announces its third consecutive year in the top decile of national patient satisfaction rankings. CMO Dr. Robert Kim credits a systemwide shift to relationship-based care and same-day access programs.", publishedDate: "Jan 2024" },
      { title: "Healthcare Unfiltered — Ep. 88: What Patients Actually Want from Their Doctor", url: "https://open.spotify.com/episode/3hTmKuWvBqSgNx6P9ZdEoJ", source: "Spotify", mediaType: "podcast", description: "Dr. Kim joins host Dr. Zubin Damania for a candid conversation about what data actually shows patients prioritize and how Meridian redesigned its intake process around those insights.", publishedDate: "Oct 2023" },
      { title: "HIMSS 2024 — AI in the Clinic: Promises, Pitfalls, and a Framework for Responsible Adoption", url: "https://www.youtube.com/watch?v=pL2vQwZxRoM", source: "YouTube", mediaType: "video", description: "Dr. Kim's HIMSS mainstage talk on Meridian's approach to deploying AI-assisted diagnostics, including the governance model the health system built to keep clinicians — not algorithms — accountable for patient outcomes.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Amanda", lastName: "Torres",
    insights: [
      { title: "How we cut patient discharge time by 40% without adding staff", url: "https://www.linkedin.com/pulse/patient-discharge-time-amanda-torres", source: "LinkedIn", mediaType: "linkedin_post", description: "Amanda's operational deep-dive into the Meridian discharge redesign project — from the spaghetti process map that started it all to the Lean interventions that cut average discharge time from 4.2 hours to 2.5.", publishedDate: "Dec 2023" },
      { title: "Operational Excellence in Healthcare: Lessons from the Front Lines", url: "https://www.healthaffairs.org/operations-excellence-hospitals", source: "Health Affairs", mediaType: "article", description: "Amanda Torres co-authors a case study on Meridian's capacity management overhaul, examining how a cross-functional operations team reduced ED wait times while improving staff satisfaction scores simultaneously.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Noah", lastName: "Williams",
    insights: [
      { title: "Why Every Fortune 500 CFO Is Now Asking About Scope 3 Emissions", url: "https://hbr.org/2024/01/scope-3-emissions-cfo-noah-williams", source: "Harvard Business Review", mediaType: "article", description: "Noah Williams makes the business case that Scope 3 reporting is no longer a compliance checkbox but a competitive differentiator — and the playbook GreenLeaf uses to help clients get there in 12 months.", publishedDate: "Jan 2024" },
      { title: "TEDx Austin — The Hidden ROI of Sustainability: Why Doing Good Is Also Good Business", url: "https://www.youtube.com/watch?v=kN7qWxZbRoP", source: "YouTube", mediaType: "video", description: "Noah's TEDx talk on the financial upside of sustainability strategy, packed with case studies from GreenLeaf clients who turned ESG investments into measurable EBITDA improvements.", publishedDate: "Jun 2023" },
      { title: "How to Save the Planet and Make Money Doing It — with Noah Williams", url: "https://open.spotify.com/episode/7pNqXrWvBsRgAb2N8YdDpH", source: "Spotify", mediaType: "podcast", description: "Noah joins the Sustainability Defined podcast to discuss how GreenLeaf prices sustainability consulting, what clients consistently underestimate about the journey, and why the best ESG programs start in the supply chain.", publishedDate: "Nov 2023" },
      { title: "GreenLeaf Solutions Named to Fast Company's Most Innovative Companies in Sustainability", url: "https://www.fastcompany.com/most-innovative-companies/greenleaf-solutions", source: "Fast Company", mediaType: "press_release", description: "Fast Company recognizes GreenLeaf Solutions as one of the 10 most innovative sustainability consultancies, citing its proprietary carbon accounting methodology and its work helping three clients achieve net-zero ahead of schedule.", publishedDate: "Mar 2024" },
      { title: "We just helped a $4B manufacturer cut carbon 30% in 18 months. Here's what actually worked.", url: "https://www.linkedin.com/pulse/carbon-reduction-manufacturing-noah-williams", source: "LinkedIn", mediaType: "linkedin_post", description: "Noah breaks down the GreenLeaf engagement methodology in unprecedented detail — the stakeholder mapping, the quick wins that built internal credibility, and the one initiative they tried that completely flopped.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Isabella", lastName: "Rossi",
    insights: [
      { title: "How to Write an ESG Report That Investors Actually Read", url: "https://medium.com/@isabella-rossi-esg/esg-reporting-investors", source: "Medium", mediaType: "blog_post", description: "Isabella's practical guide to cutting through ESG report bloat — covering the five metrics institutional investors actually track, the narrative structure that keeps them reading, and the tools her team uses for data collection.", publishedDate: "Jan 2024" },
      { title: "I reviewed 50 corporate sustainability pages this month. Here's what I found.", url: "https://www.linkedin.com/posts/isabella-rossi-sustainability", source: "LinkedIn", mediaType: "linkedin_post", description: "Isabella's viral analysis of corporate sustainability web pages, highlighting the patterns that signal genuine commitment versus greenwashing — and the one thing almost every company gets wrong in their messaging.", publishedDate: "Oct 2023" },
      { title: "The Science-Based Targets Initiative: A Practitioner's Field Guide", url: "https://www.greenbiz.com/article/science-based-targets-field-guide", source: "GreenBiz", mediaType: "article", description: "A comprehensive walkthrough of the SBTi process from first contact to validation, written by Isabella Rossi from three years of hands-on experience guiding mid-market companies through the framework.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "David", lastName: "Park",
    insights: [
      { title: "The Private Label Playbook: How Mid-Market Retailers Can Compete with Amazon's Basics", url: "https://www.retaildive.com/news/private-label-playbook-david-park", source: "Retail Dive", mediaType: "article", description: "David Park shares the sourcing, positioning, and margin strategies Nexus used to grow its private label penetration from 8% to 23% of total revenue in three years, without sacrificing brand equity.", publishedDate: "Feb 2024" },
      { title: "The Retail Rundown — Ep. 201: Trend Forecasting in the Age of Viral Products", url: "https://open.spotify.com/episode/5kRqPrXvCsRgBb4N9ZcFpI", source: "Spotify", mediaType: "podcast", description: "David joins retail podcast veterans to discuss how TikTok and short-form video have compressed trend cycles from 18 months to 6 weeks — and the buying process changes Nexus made to keep pace.", publishedDate: "Dec 2023" },
      { title: "Stop building for the customer you wish you had. Build for the one you actually have.", url: "https://www.linkedin.com/posts/david-park-merchandising", source: "LinkedIn", mediaType: "linkedin_post", description: "David's counterintuitive take on customer-centric retail, arguing that most merchant teams spend too much time on aspirational personas and not enough studying their actual repeat purchasers.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Jessica", lastName: "Lee",
    insights: [
      { title: "How Nexus Retail Grew E-commerce Revenue 3x in Two Years Without Raising Ad Spend", url: "https://www.emarketer.com/nexus-retail-ecommerce-growth-jessica-lee", source: "eMarketer", mediaType: "article", description: "A detailed case study on Nexus's omnichannel commerce transformation, co-written by Jessica Lee, covering the site redesign, checkout optimization, and loyalty program changes that drove triple-digit growth.", publishedDate: "Jan 2024" },
      { title: "ShopTalk 2024 — The Profitable E-commerce Stack: Build vs. Buy vs. Integrate", url: "https://www.youtube.com/watch?v=qM8pRxZbWoN", source: "YouTube", mediaType: "video", description: "Jessica's ShopTalk presentation on the technology decisions behind Nexus's digital transformation — including the composable commerce migration that cut their time-to-market for new features from months to weeks.", publishedDate: "Mar 2024" },
      { title: "Our A/B test improved checkout conversion by 18%. The winner surprised us.", url: "https://www.linkedin.com/pulse/ab-test-checkout-jessica-lee", source: "LinkedIn", mediaType: "linkedin_post", description: "Jessica shares the counterintuitive result of Nexus's biggest checkout redesign test — and why the winning variant challenged everything the team thought they knew about reducing friction.", publishedDate: "Feb 2024" },
      { title: "First-Party Data Is the New Moat: How Retailers Can Build It Before It's Too Late", url: "https://medium.com/@jessica-lee-ecom/first-party-data-retail", source: "Medium", mediaType: "blog_post", description: "With third-party cookies fading, Jessica outlines the customer data strategy Nexus built from scratch — loyalty mechanics, zero-party data collection, and the tech stack that ties it all together.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Tyler", lastName: "Brooks",
    insights: [
      { title: "The Director's Cut — How We Made Orbital's Most-Streamed Original in 9 Weeks", url: "https://www.youtube.com/watch?v=rT5sQwZbYoM", source: "YouTube", mediaType: "video", description: "Tyler gives an unfiltered behind-the-scenes look at the compressed production timeline, the creative compromises that weren't, and the single scene that almost killed the entire project.", publishedDate: "Dec 2023" },
      { title: "Streaming Has Changed What \"Good\" Looks Like. Here's How Creative Directors Adapt.", url: "https://variety.com/2024/streaming-creative-direction-tyler-brooks", source: "Variety", mediaType: "article", description: "Tyler Brooks argues that streaming platforms' data-driven feedback loops are reshaping creative decision-making in ways that are sometimes liberating, sometimes stifling — and what smart CDs do about it.", publishedDate: "Feb 2024" },
      { title: "Orbital Media's \"The Long Way Home\" Wins Emmy for Outstanding Limited Series", url: "https://www.prnewswire.com/orbital-media-emmy-win-2023", source: "PR Newswire", mediaType: "press_release", description: "Orbital Media celebrates its Emmy win for Outstanding Limited Series, with Creative Director Tyler Brooks accepting on behalf of the production team and dedicating the award to the writers room.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Sophia", lastName: "Martinez",
    insights: [
      { title: "Beyond Accuracy: The Metrics That Actually Matter for Production ML Models", url: "https://towardsdatascience.com/production-ml-metrics-sophia-martinez", source: "Towards Data Science", mediaType: "article", description: "Sophia challenges the ML community's fixation on accuracy and F1 score, making the case for calibration, distributional robustness, and business-relevant KPIs as the true indicators of model quality.", publishedDate: "Jan 2024" },
      { title: "Building a Feature Store from Scratch: Lessons from Quartz's First Year", url: "https://medium.com/@sophia-martinez-ds/feature-store-lessons", source: "Medium", mediaType: "blog_post", description: "A candid 12-month retrospective on Quartz's internal feature store project — the architectural decisions that aged well, the ones that didn't, and what Sophia would do differently starting today.", publishedDate: "Nov 2023" },
      { title: "NeurIPS 2023 Workshop — Practical NLP for Unstructured Enterprise Data", url: "https://www.youtube.com/watch?v=sL4tRwZbXoQ", source: "YouTube", mediaType: "video", description: "Sophia's workshop session at NeurIPS on applying transformer-based NLP to messy, domain-specific enterprise datasets — covering labeling strategies, fine-tuning trade-offs, and deployment pitfalls.", publishedDate: "Dec 2023" },
      { title: "DataFramed — Ep. 193: From Academic ML to Production Data Science", url: "https://open.spotify.com/episode/6mSnXrWvDsRhCb5N0ZbGpK", source: "Spotify", mediaType: "podcast", description: "Sophia joins DataCamp's podcast to discuss the skills gap between academic machine learning and real-world data science — and the three things she wishes someone had told her before her first industry role.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Liam", lastName: "Thompson",
    insights: [
      { title: "The Science of Sales — Ep. 145: Enterprise Deals, Pipeline Math, and Why Most Reps Forecast Wrong", url: "https://open.spotify.com/episode/4kPqNrWvEsRgDb6O1ZaHpL", source: "Spotify", mediaType: "podcast", description: "Liam Thompson joins the Science of Sales podcast to break down the pipeline velocity model he uses to call quarters accurately, the signals he looks for in late-stage deals, and how to coach reps out of happy-ears syndrome.", publishedDate: "Feb 2024" },
      { title: "Cold email is dead. Here's what replaced it at Quartz.", url: "https://www.linkedin.com/posts/liam-thompson-sales", source: "LinkedIn", mediaType: "linkedin_post", description: "Liam's most-engaged post of the year: a breakdown of Quartz's outbound motion pivot — from spray-and-pray email sequences to a signal-based, research-first approach that doubled reply rates in 90 days.", publishedDate: "Jan 2024" },
      { title: "SaaStr Annual — Closing the Enterprise: The First 90-Day Sales Cycle Blueprint", url: "https://www.youtube.com/watch?v=tN6qQwZbZoR", source: "YouTube", mediaType: "video", description: "Liam's SaaStr session on structuring enterprise sales from first meeting to legal, including the multi-threading framework he uses to prevent deals from dying when a champion leaves.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Catherine", lastName: "Hughes",
    insights: [
      { title: "Targeted Therapy at the Inflection Point: Where Oncology Is Headed in the Next Decade", url: "https://www.nejm.org/doi/10.1056/NEJMra2024/catherine-hughes", source: "New England Journal of Medicine", mediaType: "article", description: "Dr. Hughes co-authors a perspective piece in NEJM on the scientific and commercial convergence reshaping cancer treatment — from ADCs and bispecifics to the regulatory landscape that will define approvals through 2030.", publishedDate: "Mar 2024" },
      { title: "Spectrum Pharma's Lead Oncology Compound Advances to Phase III Trial", url: "https://www.businesswire.com/spectrum-pharma-phase-iii-announcement", source: "Business Wire", mediaType: "press_release", description: "Spectrum Pharma announces positive Phase II results and the initiation of a Phase III trial for its lead rare disease oncology compound, with Chief Scientific Officer Dr. Catherine Hughes leading the global clinical program.", publishedDate: "Jan 2024" },
      { title: "The Long Run — Science, Setbacks, and the 20-Year Path to a Drug Approval", url: "https://open.spotify.com/episode/2pKqMrWvFsRiAb7N1YcDpM", source: "Spotify", mediaType: "podcast", description: "Dr. Hughes joins The Long Run podcast for an hour-long conversation about the emotional and scientific arc of drug development, the trial failure that almost ended her career, and why she believes the next decade will be oncology's golden age.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "William", lastName: "Foster",
    insights: [
      { title: "Industry 4.0 in a Union Shop: What No One Tells You About Automation Adoption", url: "https://www.industryweek.com/automation-adoption-william-foster", source: "IndustryWeek", mediaType: "article", description: "William Foster shares the unfiltered story of Apex's automation rollout — the labor relations challenges, the change management missteps, and the workforce retraining program that ultimately turned skeptics into advocates.", publishedDate: "Feb 2024" },
      { title: "IMTS 2023 — Predictive Maintenance at Scale: Moving from Reactive to Anticipatory", url: "https://www.youtube.com/watch?v=uO7rRwZbAoS", source: "YouTube", mediaType: "video", description: "William's IMTS keynote on Apex's five-year journey to predictive maintenance, from the first vibration sensor pilot to the ML-powered monitoring system that reduced unplanned downtime by 60%.", publishedDate: "Sep 2023" },
      { title: "Why We Stopped Chasing OEE and Started Measuring Constraint Velocity", url: "https://medium.com/@william-foster-eng/oee-constraint-velocity", source: "Medium", mediaType: "blog_post", description: "A manufacturing engineering deep-dive on the limitations of Overall Equipment Effectiveness as a primary KPI — and the alternative metric Apex developed that better captures throughput at the bottleneck.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Rachel", lastName: "Green",
    insights: [
      { title: "500 people. One facility. Here's how we hit our safety milestone.", url: "https://www.linkedin.com/posts/rachel-green-manufacturing", source: "LinkedIn", mediaType: "linkedin_post", description: "Rachel's heartfelt post celebrating the Detroit facility's 1,000-day zero-incident milestone — and the daily safety rituals, near-miss reporting culture, and union partnership that made it possible.", publishedDate: "Jan 2024" },
      { title: "The Human Side of Lean: Why Process Improvement Fails Without Culture Change", url: "https://www.industryweek.com/lean-culture-rachel-green", source: "IndustryWeek", mediaType: "article", description: "Rachel co-authors a piece on why most Lean transformations stall at 18 months — and the floor-level engagement practices Apex's Detroit plant used to sustain continuous improvement long after the consultants left.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Michael", lastName: "Scott",
    insights: [
      { title: "The Competency Gap in Professional Certification: What Industry Wants vs. What Programs Deliver", url: "https://www.insidehighered.com/competency-gap-professional-cert-michael-scott", source: "Inside Higher Ed", mediaType: "article", description: "Michael Scott's research-based analysis of the disconnect between professional certification outcomes and employer expectations — and the competency mapping methodology Lighthouse Education uses to close it.", publishedDate: "Jan 2024" },
      { title: "Learning & Development Podcast — Ep. 77: Designing for Adult Learners Who Are Already Busy", url: "https://open.spotify.com/episode/8pQqOrWvGsRjDb8N2ZdFpN", source: "Spotify", mediaType: "podcast", description: "Michael joins the L&D podcast to discuss the principles behind Lighthouse's modular curriculum design — how they structure content for working professionals who have 20-minute windows, not 3-hour workshops.", publishedDate: "Oct 2023" },
      { title: "AI Won't Replace Instructional Designers. But It Will Change Everything About the Job.", url: "https://medium.com/@michael-scott-edu/ai-instructional-design", source: "Medium", mediaType: "blog_post", description: "Michael's nuanced take on where generative AI genuinely accelerates curriculum development versus where it produces plausible-sounding content that would actually mislead learners.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Karen", lastName: "Walsh",
    insights: [
      { title: "How Lighthouse Education Went from 10,000 to 500,000 Users in Three Years", url: "https://www.growthunhinged.com/lighthouse-education-growth-karen-walsh", source: "Growth Unhinged", mediaType: "article", description: "Kyle Poyar interviews Karen Walsh about the channel mix, retention loops, and pricing experiments that fueled Lighthouse's hypergrowth — including the counterintuitive decision to slow paid acquisition in year two.", publishedDate: "Mar 2024" },
      { title: "The growth channel everyone ignores (it drove 40% of our signups last quarter)", url: "https://www.linkedin.com/pulse/growth-channel-ignored-karen-walsh", source: "LinkedIn", mediaType: "linkedin_post", description: "Karen's breakdown of Lighthouse's community-led growth motion — why they invested in a Slack community with no direct conversion goal, and how it became their highest-intent acquisition channel 18 months later.", publishedDate: "Jan 2024" },
      { title: "Lenny's Podcast — Growth Loops, Referral Programs, and What Actually Works in EdTech", url: "https://open.spotify.com/episode/1rNqPrWvHsRkEb9N3ZeGpO", source: "Spotify", mediaType: "podcast", description: "Karen joins Lenny Rachitsky to discuss EdTech-specific growth challenges, the referral mechanic that drove Lighthouse's B2B expansion, and the one metric she checks every single morning.", publishedDate: "Dec 2023" },
      { title: "GrowthHackers Summit — Retention-First Growth: Why We Stopped Optimizing the Funnel Top", url: "https://www.youtube.com/watch?v=vP9sSwZbBoT", source: "YouTube", mediaType: "video", description: "Karen's summit presentation on Lighthouse's pivot from acquisition-heavy to retention-led growth — including the cohort analysis that revealed they were filling a leaky bucket, and what they fixed first.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Carlos", lastName: "Rivera",
    insights: [
      { title: "Last-mile delivery is broken. Here's how we're fixing it at Vantage.", url: "https://www.linkedin.com/pulse/last-mile-delivery-fix-carlos-rivera", source: "LinkedIn", mediaType: "linkedin_post", description: "Carlos's candid post on the structural dysfunction in last-mile logistics — driver churn, route inefficiency, customer expectations — and the three operational changes Vantage made that immediately moved the needle.", publishedDate: "Feb 2024" },
      { title: "Vantage Logistics Expands Same-Day Delivery Network to 12 New Metro Markets", url: "https://www.businesswire.com/vantage-logistics-same-day-expansion", source: "Business Wire", mediaType: "press_release", description: "Vantage Logistics announces a major geographic expansion of its same-day delivery service, enabled by a new micro-fulfillment partnership model developed under VP of Operations Carlos Rivera.", publishedDate: "Jan 2024" },
      { title: "Supply Chain Resilience After the Disruption Years: What Durable Operations Actually Look Like", url: "https://www.supplychainbrain.com/resilience-durable-operations-carlos-rivera", source: "Supply Chain Brain", mediaType: "article", description: "Carlos Rivera co-authors a post-pandemic supply chain retrospective, examining which resilience investments paid off and which turned out to be costly overreactions — with prescriptions for what to build next.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Aisha", lastName: "Okafor",
    insights: [
      { title: "Zero Trust Is Not a Product. It's a Philosophy — and Most Companies Are Doing It Wrong.", url: "https://www.darkreading.com/zero-trust-philosophy-aisha-okafor", source: "Dark Reading", mediaType: "article", description: "Aisha Okafor dismantles the vendor-driven definition of Zero Trust and offers a framework for security leaders to evaluate their actual posture versus the marketing narrative they've been sold.", publishedDate: "Feb 2024" },
      { title: "Risky Business — Ep. 710: Inside a Nation-State Threat Hunt", url: "https://open.spotify.com/episode/0sOrPrWvIsRlFb0O4ZfIpP", source: "Spotify", mediaType: "podcast", description: "Aisha joins the Risky Business podcast for a rare public account of a nation-state threat hunting engagement — the indicators that first triggered the investigation, the 11-day hunt, and what the attacker's objective turned out to be.", publishedDate: "Mar 2024" },
      { title: "Black Hat USA 2023 — From NSA to the Private Sector: Translating Intelligence Tradecraft", url: "https://www.youtube.com/watch?v=wQ0tTwZbCoU", source: "YouTube", mediaType: "video", description: "Aisha's Black Hat talk on the mindset and methodologies she brought from her NSA career into commercial cybersecurity — including the threat modeling technique that has consistently caught what automated tools miss.", publishedDate: "Aug 2023" },
      { title: "Cobalt Cybersecurity Named a Gartner Cool Vendor in Threat Intelligence", url: "https://www.prnewswire.com/cobalt-cybersecurity-gartner-cool-vendor", source: "PR Newswire", mediaType: "press_release", description: "Gartner recognizes Cobalt Cybersecurity as a Cool Vendor in Threat Intelligence, citing CISO Aisha Okafor's novel approach to operationalizing intelligence feeds within lean security teams.", publishedDate: "Apr 2024" },
      { title: "How We Built a Threat Intelligence Program for Under $50K (Without a Full-Time Analyst)", url: "https://medium.com/@aisha-okafor-ciso/threat-intel-budget", source: "Medium", mediaType: "blog_post", description: "Aisha's detailed guide to standing up a functional threat intelligence capability at small and mid-size companies — tooling, process, community resources, and the free feeds that are actually worth your time.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Ben", lastName: "Carter",
    insights: [
      { title: "Developer marketing doesn't work like B2B marketing. Here's what we learned.", url: "https://www.linkedin.com/pulse/developer-marketing-lessons-ben-carter", source: "LinkedIn", mediaType: "linkedin_post", description: "Ben's most-shared post on the fundamental differences between marketing to developers versus traditional B2B buyers — and the messaging, channel, and community strategy pivots Acme made as a result.", publishedDate: "Jan 2024" },
      { title: "Building a Developer Community That Doesn't Feel Like Marketing", url: "https://medium.com/@ben-carter-mktg/developer-community-authentic", source: "Medium", mediaType: "blog_post", description: "Ben walks through Acme's community building playbook — the Discord strategy, the open-source contribution incentives, and the hard lesson about what happens when community members sense they're being monetized.", publishedDate: "Nov 2023" },
      { title: "Content Marketing for Developer Tools: What Actually Drives Sign-Ups", url: "https://www.contentmarketinginstitute.com/developer-tools-content-ben-carter", source: "Content Marketing Institute", mediaType: "article", description: "A data-driven breakdown of Acme's content performance over 18 months, revealing which formats, topics, and distribution channels drove qualified sign-ups — and the surprising underperformer they almost doubled down on.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Hannah", lastName: "White",
    insights: [
      { title: "Writing PRDs That Engineers Actually Read (And Like)", url: "https://medium.com/@hannah-white-pm/prds-engineers-read", source: "Medium", mediaType: "blog_post", description: "Hannah's practical guide to product requirement documents that drive alignment rather than confusion — covering the one-page format, the decision log, and the three questions every PRD must answer before kickoff.", publishedDate: "Feb 2024" },
      { title: "Hot take: \"talking to customers\" is not a substitute for having a coherent product strategy", url: "https://www.linkedin.com/posts/hannah-white-product", source: "LinkedIn", mediaType: "linkedin_post", description: "Hannah's provocative take on the discovery-without-strategy trap — where PMs run dozens of customer interviews but still can't articulate a clear product thesis. 2,800 comments and counting.", publishedDate: "Dec 2023" },
      { title: "ProductCon 2023 — Analytics Products for Non-Technical Users: Design Principles That Work", url: "https://www.youtube.com/watch?v=xR1uUwZbDoV", source: "YouTube", mediaType: "video", description: "Hannah's ProductCon session on designing self-serve analytics features for users who didn't ask for a BI tool — the progressive disclosure patterns, default views, and onboarding flows that drive adoption without training.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Ahmed", lastName: "Hassan",
    insights: [
      { title: "The CFO's Guide to Navigating Omnichannel P&L Complexity", url: "https://www.cfo.com/omnichannel-pnl-ahmed-hassan", source: "CFO Magazine", mediaType: "article", description: "Ahmed Hassan breaks down the attribution and cost allocation challenges that make retail P&L analysis so thorny in an omnichannel world — and the financial modeling framework Nexus uses to make channel profitability visible.", publishedDate: "Mar 2024" },
      { title: "Nexus Retail Group Reports 14% Year-Over-Year Revenue Growth, Driven by Digital and Private Label", url: "https://www.businesswire.com/nexus-retail-annual-results-2024", source: "Business Wire", mediaType: "press_release", description: "Nexus Retail Group announces strong full-year financial results, with CFO Ahmed Hassan citing digital channel profitability and private label margin expansion as the two primary drivers of earnings outperformance.", publishedDate: "Feb 2024" },
      { title: "CFO Thought Leader — Ep. 441: Capital Allocation in Retail: Playing Offense When Margins Are Tight", url: "https://open.spotify.com/episode/9tVqQrWvJsRmGb1P5ZgJpQ", source: "Spotify", mediaType: "podcast", description: "Ahmed joins the CFO Thought Leader podcast to discuss how Nexus approaches capital allocation decisions during margin compression — the hurdle rates, the portfolio approach to innovation investment, and the one bet he's most proud of.", publishedDate: "Jan 2024" },
    ],
  },
];

export async function seedInsightsIfEmpty() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_insights (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        title VARCHAR(500) NOT NULL,
        url VARCHAR(1000) NOT NULL,
        source VARCHAR(200) NOT NULL,
        media_type VARCHAR(50) NOT NULL,
        description TEXT,
        published_date VARCHAR(50)
      )
    `);
  } finally {
    client.release();
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contactInsightsTable);

  if (count > 0) {
    console.log(`Insights already seeded (${count} records). Skipping.`);
    return;
  }

  console.log("Seeding contact insights...");
  for (const { firstName, lastName, insights } of INSIGHTS_BY_NAME) {
    const [contact] = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.firstName, firstName),
          eq(contactsTable.lastName, lastName),
        ),
      )
      .limit(1);

    if (!contact) {
      console.warn(`Contact not found: ${firstName} ${lastName} — skipping insights.`);
      continue;
    }

    await db.insert(contactInsightsTable).values(
      insights.map((i) => ({
        contactId: contact.id,
        title: i.title,
        url: i.url,
        source: i.source,
        mediaType: i.mediaType,
        description: i.description,
        publishedDate: i.publishedDate,
      })),
    );
    console.log(`Seeded ${insights.length} insights for ${firstName} ${lastName}.`);
  }
}

export async function seedIfEmpty() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companiesTable);

  if (count > 0) {
    console.log(`Database already seeded (${count} companies). Skipping.`);
    return;
  }

  console.log("Seeding database...");

  // Insert companies
  const inserted = await db.insert(companiesTable).values(COMPANIES).returning({ id: companiesTable.id, name: companiesTable.name });

  const companyMap: Record<string, number> = {};
  for (const co of inserted) {
    companyMap[co.name] = co.id;
  }

  // Insert contacts with resolved company IDs
  const contactRows = CONTACTS.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    jobTitle: c.jobTitle ?? null,
    department: c.department ?? null,
    seniority: c.seniority ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    location: c.location ?? null,
    country: c.country ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    twitterHandle: c.twitterHandle ?? null,
    bio: c.bio ?? null,
    companyId: c.companyName ? companyMap[c.companyName] ?? null : null,
  }));

  await db.insert(contactsTable).values(contactRows);

  console.log(`Seeded ${inserted.length} companies and ${contactRows.length} contacts.`);
}
