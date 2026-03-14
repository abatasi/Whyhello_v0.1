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
  {
    firstName: "Jordan", lastName: "Bates",
    insights: [
      { title: "Patient Experience Is a Business Strategy, Not a Soft Metric", url: "https://www.healthaffairs.org/patient-experience-strategy-jordan-bates", source: "Health Affairs", mediaType: "article", description: "Jordan Bates makes the financial case for patient experience investment, drawing on Meridian's data showing a direct correlation between HCAHPS scores and 30-day readmission rates — and what that means for reimbursement.", publishedDate: "Feb 2024" },
      { title: "How we redesigned the patient journey from referral to discharge — and what we learned", url: "https://www.linkedin.com/pulse/patient-journey-redesign-jordan-bates", source: "LinkedIn", mediaType: "linkedin_post", description: "Jordan's detailed walkthrough of Meridian's 18-month patient journey mapping project — the service design methods, the staff co-creation sessions, and the three moments of truth that changed everything.", publishedDate: "Nov 2023" },
      { title: "SHSMD Connections 2023 — Co-Designing Care: Putting Patients on the Design Team", url: "https://www.youtube.com/watch?v=yB2vRwZbFoW", source: "YouTube", mediaType: "video", description: "Jordan's SHSMD presentation on Meridian's patient advisory council model — how they recruit, structure sessions, and translate patient input into operational and facility design decisions.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Maya", lastName: "Singh",
    insights: [
      { title: "What Netflix Gets Wrong About Content Strategy (And What Streamers Should Do Instead)", url: "https://variety.com/2024/streaming-content-strategy-maya-singh", source: "Variety", mediaType: "article", description: "Maya Singh argues that platform-wide algorithmic optimization is cannibalizing the bold, distinct storytelling that built streaming audiences — and outlines the editorial strategy Orbital uses to resist the pull toward sameness.", publishedDate: "Jan 2024" },
      { title: "The Streamer's Dilemma: Volume vs. Distinction", url: "https://medium.com/@maya-singh-content/streamers-dilemma", source: "Medium", mediaType: "blog_post", description: "Maya's widely shared essay on the structural incentives pushing streaming platforms toward content volume over creative differentiation — and how a programming philosophy anchored in distinct voices can break the cycle.", publishedDate: "Sep 2023" },
      { title: "We passed on this show three times. Here's why we finally greenlit it — and what happened next.", url: "https://www.linkedin.com/posts/maya-singh-orbital", source: "LinkedIn", mediaType: "linkedin_post", description: "Maya's candid post on Orbital's most-streamed original — the pitch that failed twice, the development note that unlocked it, and what the show's breakout success taught the acquisitions team about trusting unconventional voices.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Oliver", lastName: "Whitmore",
    insights: [
      { title: "Decentralized Trial Design: The Regulatory and Operational Reality", url: "https://www.appliedclinicaltrialsonline.com/dct-reality-oliver-whitmore", source: "Applied Clinical Trials", mediaType: "article", description: "Oliver Whitmore provides a practitioner's view of decentralized clinical trials after leading three DCT programs at Spectrum — covering patient retention, data quality, and the regulatory conversations no vendor will have with you.", publishedDate: "Feb 2024" },
      { title: "DIA Global Annual Meeting 2023 — Adaptive Trial Design: Lessons from the Field", url: "https://www.youtube.com/watch?v=zC3sSxZbGoX", source: "YouTube", mediaType: "video", description: "Oliver's DIA session on the adaptive design decisions behind Spectrum's Phase II oncology trial — the interim analysis triggers, the sample size re-estimation, and the one modification the FDA pushed back on.", publishedDate: "Jun 2023" },
      { title: "The Clinical Leader Podcast — Ep. 63: What Sponsors Get Wrong About Site Relationships", url: "https://open.spotify.com/episode/1qNrPrWvKsRnFb1P6ZhJpR", source: "Spotify", mediaType: "podcast", description: "Oliver joins The Clinical Leader to discuss the underappreciated role of site relationships in trial performance — the engagement practices Spectrum uses that have reduced screen failure rates and improved protocol adherence.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Derek", lastName: "Huang",
    insights: [
      { title: "Cloud Penetration Testing in 2024: What's Changed and What's Still Broken", url: "https://www.darkreading.com/cloud-pen-testing-derek-huang", source: "Dark Reading", mediaType: "article", description: "Derek Huang surveys the current cloud attack surface — misconfigured IAM policies, lateral movement via SSRF, and the one finding that shows up in 80% of Cobalt's cloud engagements.", publishedDate: "Jan 2024" },
      { title: "I spent 48 hours trying to break into a \"secure\" cloud environment. Here's what I found.", url: "https://www.linkedin.com/posts/derek-huang-security", source: "LinkedIn", mediaType: "linkedin_post", description: "Derek's most-shared post — a sanitized walkthrough of a Cobalt red team engagement where a single overpermissioned service account led to full environment compromise in under two days.", publishedDate: "Oct 2023" },
      { title: "DEF CON 31 — Weaponizing Forgotten Cloud Resources: An Attacker's Toolkit", url: "https://www.youtube.com/watch?v=aC4tTwZbHoY", source: "YouTube", mediaType: "video", description: "Derek's DEF CON talk on the class of cloud vulnerabilities hiding in forgotten resources — abandoned Lambda functions, orphaned S3 buckets, and dormant IAM roles that red teams consistently exploit.", publishedDate: "Aug 2023" },
    ],
  },
  {
    firstName: "Natalie", lastName: "Brooks",
    insights: [
      { title: "How I Sold My First SaaS Company and What I'd Do Differently the Second Time", url: "https://techcrunch.com/2024/01/natalie-brooks-saas-exit-lessons", source: "TechCrunch", mediaType: "article", description: "Natalie Brooks reflects on her first acquisition — the due diligence surprises, the negotiation dynamics, and the founder mistakes she's seen repeated in every deal she's looked at since.", publishedDate: "Jan 2024" },
      { title: "SaaStr Annual 2023 — Building a Company You'd Want to Acquire: Lessons from Two Exits", url: "https://www.youtube.com/watch?v=bD5uSwZbIoZ", source: "YouTube", mediaType: "video", description: "Natalie's SaaStr keynote drawing on her two acquisition experiences to outline what buyers actually look for beyond ARR — the operational maturity, customer concentration, and team depth that determine deal multiples.", publishedDate: "Sep 2023" },
      { title: "The First-Time CEO's Playbook: What No One Tells You About the Role", url: "https://open.spotify.com/episode/2sOrQrWvLsRoGb2P7ZiKpS", source: "Spotify", mediaType: "podcast", description: "Natalie joins the Operators podcast for a wide-ranging conversation on the CEO role — board management, the loneliness of the job, how she thinks about her own coaching and development, and what she looks for when hiring executives.", publishedDate: "Nov 2023" },
      { title: "Founders: your sales team is not the problem. Your ICP is.", url: "https://www.linkedin.com/pulse/icp-sales-problem-natalie-brooks", source: "LinkedIn", mediaType: "linkedin_post", description: "Natalie's direct post to early-stage founders on the root cause of most B2B sales struggles — and why the answer is almost never hiring a better VP of Sales.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Ethan", lastName: "Rivera",
    insights: [
      { title: "Scaling an Engineering Org Without Losing Engineering Culture", url: "https://medium.com/@ethan-rivera-eng/scaling-engineering-culture", source: "Medium", mediaType: "blog_post", description: "Ethan documents the intentional practices Pinnacle put in place as the engineering team grew from 12 to 65 — the guild structure, the architecture review process, and the rituals that kept technical excellence from eroding under delivery pressure.", publishedDate: "Dec 2023" },
      { title: "QCon San Francisco 2023 — Distributed Systems Patterns for Mid-Scale SaaS", url: "https://www.youtube.com/watch?v=cE6vTwZbJoA", source: "YouTube", mediaType: "video", description: "Ethan's QCon talk on the distributed systems patterns Pinnacle uses at their scale — event sourcing decisions, the CQRS trade-offs that didn't pan out, and the architecture choices they'd change with hindsight.", publishedDate: "Oct 2023" },
      { title: "We cut our p99 API latency by 60% without rewriting anything. Here's how.", url: "https://www.linkedin.com/posts/ethan-rivera-pinnacle", source: "LinkedIn", mediaType: "linkedin_post", description: "Ethan's step-by-step breakdown of Pinnacle's latency investigation — the profiling tools, the surprising bottleneck they found, and the targeted optimizations that delivered outsized gains.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Grace", lastName: "Liu",
    insights: [
      { title: "Designing for Power Users Without Alienating Beginners", url: "https://uxdesign.cc/power-users-beginners-grace-liu", source: "UX Collective", mediaType: "article", description: "Grace Liu shares Pinnacle's design system philosophy for enterprise software — the progressive disclosure patterns, keyboard shortcut strategies, and contextual help approaches that serve both casual and expert users.", publishedDate: "Jan 2024" },
      { title: "I user-tested our onboarding flow with 20 new customers. Here's what I found.", url: "https://www.linkedin.com/pulse/onboarding-user-test-grace-liu", source: "LinkedIn", mediaType: "linkedin_post", description: "Grace's transparent account of a brutal onboarding usability study — the moments where users got lost, the assumptions the team had wrong, and the redesign that cut time-to-value by 40%.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Victor", lastName: "Zhao",
    insights: [
      { title: "Why B2B SaaS Multiples Are Resetting — and What That Means for Founders Raising in 2024", url: "https://fortune.com/2024/02/b2b-saas-multiples-victor-zhao", source: "Fortune", mediaType: "article", description: "Victor Zhao of Cascade Capital analyzes the recalibration in B2B SaaS valuations, what sustainable growth metrics look like in the current environment, and how founders should frame their narratives for investors.", publishedDate: "Feb 2024" },
      { title: "20 Minutes VC — Ep. 2,140: Building Conviction on Pre-Traction B2B Companies", url: "https://open.spotify.com/episode/3tPqRrWvMsRpHc3P8ZjLpT", source: "Spotify", mediaType: "podcast", description: "Victor joins Harry Stebbings to discuss how Cascade evaluates pre-traction B2B opportunities — the market structure signals, founder reference patterns, and competitive dynamics that inform early conviction.", publishedDate: "Jan 2024" },
      { title: "The frameworks that got me to Partner and the ones I had to unlearn", url: "https://www.linkedin.com/pulse/frameworks-partner-victor-zhao", source: "LinkedIn", mediaType: "linkedin_post", description: "Victor's reflective post on the mental models from consulting that transferred well to venture investing — and the ones that created blind spots he had to consciously break.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Simone", lastName: "Dupont",
    insights: [
      { title: "Operator-Turned-Investor: What Two Years at a VC Firm Has Taught Me", url: "https://medium.com/@simone-dupont-vc/operator-investor-lessons", source: "Medium", mediaType: "blog_post", description: "Simone reflects on the mindset shifts required going from operator to investor — the pattern recognition that transferred, the instincts that led her astray, and what she now understands about founder decision-making that she couldn't see from inside a company.", publishedDate: "Nov 2023" },
      { title: "Fintech's Next Wave: Where the Real Opportunities Are After the Correction", url: "https://www.linkedin.com/pulse/fintech-next-wave-simone-dupont", source: "LinkedIn", mediaType: "linkedin_post", description: "Simone's sector analysis of where Cascade is finding compelling fintech opportunities post-2021 — the verticals that survived the reset, the infrastructure layers getting rebuilt, and the customer segments still underserved.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Andre", lastName: "Jefferson",
    insights: [
      { title: "The Energy Transition From an Operator's Perspective: What the Headlines Miss", url: "https://hbr.org/2024/01/energy-transition-operator-andre-jefferson", source: "Harvard Business Review", mediaType: "article", description: "Andre Jefferson moves past the policy debate to examine the operational realities of energy transition — grid reliability constraints, workforce retraining challenges, and the project development bottlenecks that will determine how fast the shift actually happens.", publishedDate: "Jan 2024" },
      { title: "CERAWeek 2023 — Building the Renewable Energy Workforce: Lessons from the Oil Patch", url: "https://www.youtube.com/watch?v=dF7tSwZbKoB", source: "YouTube", mediaType: "video", description: "Andre's CERAWeek panel session on what the oil and gas industry's workforce development playbook can teach the renewables sector — craft training programs, safety culture, and the institutional knowledge being lost in the transition.", publishedDate: "Mar 2023" },
      { title: "Solaris Energy Closes $1.2B Financing for Three Solar + Storage Projects", url: "https://www.businesswire.com/solaris-energy-financing-close", source: "Business Wire", mediaType: "press_release", description: "Solaris Energy announces the financial close of its largest project portfolio to date, with COO Andre Jefferson overseeing the construction ramp-up across sites in Texas, Nevada, and Arizona.", publishedDate: "Feb 2024" },
      { title: "The 3 biggest operational mistakes I see in renewable energy project development", url: "https://www.linkedin.com/posts/andre-jefferson-solaris", source: "LinkedIn", mediaType: "linkedin_post", description: "Andre's direct post cataloguing the project development errors he has seen repeated across the industry — from interconnection queue mismanagement to contractor selection mistakes that blow timelines.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Mei", lastName: "Zhang",
    insights: [
      { title: "Project Finance for Renewables: The Lender's Checklist Every Developer Needs to Know", url: "https://www.infrastructureinvestor.com/project-finance-renewables-mei-zhang", source: "Infrastructure Investor", mediaType: "article", description: "Mei Zhang demystifies the lender due diligence process for utility-scale renewable projects — from resource assessment requirements to offtake contract structures and the common deal-killers that developers should address before going to market.", publishedDate: "Mar 2024" },
      { title: "How we structured a $400M tax equity deal for a merchant solar project in a volatile rate environment", url: "https://www.linkedin.com/pulse/tax-equity-merchant-solar-mei-zhang", source: "LinkedIn", mediaType: "linkedin_post", description: "Mei breaks down the financing structure behind one of Solaris's most complex transactions — the tax equity partnership mechanics, the merchant risk mitigation strategies, and the negotiation dynamics with an institutional investor.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Leo", lastName: "Moretti",
    insights: [
      { title: "Brand Is Not What You Say. It's What You Do When No One Is Watching.", url: "https://adage.com/article/brand-identity-leo-moretti", source: "Ad Age", mediaType: "article", description: "Leo Moretti's perspective on the gap between brand strategy and brand reality — why most brand campaigns underdeliver and the Brightwave framework for making sure creative work reflects how clients actually behave.", publishedDate: "Feb 2024" },
      { title: "Cannes Lions 2023 — The Creativity Paradox: How Data Made Us Safer and Less Surprising", url: "https://www.youtube.com/watch?v=eH8uTwZbLoC", source: "YouTube", mediaType: "video", description: "Leo's Cannes Lions talk on the tension between data-driven creative optimization and genuinely breakthrough work — and the case for preserving creative risk-taking in an era of A/B-tested everything.", publishedDate: "Jun 2023" },
      { title: "Brightwave Named Agency of the Year by The Drum", url: "https://www.prnewswire.com/brightwave-agency-of-year-drum", source: "PR Newswire", mediaType: "press_release", description: "The Drum recognizes Brightwave Marketing as Agency of the Year for its work on three campaigns that won Grand Prix awards, with CCO Leo Moretti accepting on behalf of a 140-person creative team.", publishedDate: "Dec 2023" },
      { title: "What I've learned from 40+ brand campaigns that completely flopped", url: "https://www.linkedin.com/pulse/brand-campaigns-flopped-leo-moretti", source: "LinkedIn", mediaType: "linkedin_post", description: "Leo's rare and refreshingly honest post on the failure patterns he has seen across two decades of brand work — the client approval dynamics, the research misinterpretations, and the creative committee decisions that produce forgettable work.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Zara", lastName: "Ahmed",
    insights: [
      { title: "The Death of the Performance Marketing Playbook (And What's Replacing It)", url: "https://marketingweek.com/performance-marketing-evolution-zara-ahmed", source: "Marketing Week", mediaType: "article", description: "Zara Ahmed argues that the core performance marketing playbook — pixel targeting, last-click attribution, scaled creative testing — is breaking down under privacy changes and market saturation, and outlines the hybrid approaches that are working now.", publishedDate: "Jan 2024" },
      { title: "Our Meta ROAS dropped 40%. Here's what we did about it.", url: "https://medium.com/@zara-ahmed-mktg/meta-roas-recovery", source: "Medium", mediaType: "blog_post", description: "Zara's transparent case study on Brightwave's response to a significant client's Meta performance collapse — the diagnostic process, the channel mix recalibration, and the creative strategy shift that rebuilt returns over 90 days.", publishedDate: "Oct 2023" },
      { title: "Stop optimizing for clicks. Start optimizing for customers.", url: "https://www.linkedin.com/posts/zara-ahmed-performance", source: "LinkedIn", mediaType: "linkedin_post", description: "Zara's post on the proxy metric trap in performance marketing — why optimizing for CTR and low CPCs can systematically attract the wrong customers, with data from three client accounts to back it up.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Patricia", lastName: "Monroe",
    insights: [
      { title: "M&A Due Diligence in the Age of AI: What Acquirers Are Missing", url: "https://www.law.com/ma-due-diligence-ai-patricia-monroe", source: "Law.com", mediaType: "article", description: "Patricia Monroe argues that standard M&A due diligence frameworks are not equipped to evaluate AI-dependent businesses — and lays out the IP, liability, and regulatory questions that counsel must add to the standard playbook.", publishedDate: "Mar 2024" },
      { title: "The Deal — Navigating Material Adverse Change Clauses After COVID: Lessons That Apply Now", url: "https://open.spotify.com/episode/4uQrSrWvNsRqIc4P9ZkMpU", source: "Spotify", mediaType: "podcast", description: "Patricia joins The Deal podcast to discuss how MAC clause interpretation has evolved after the pandemic litigation wave — what buyers and sellers should negotiate today, and the provisions that are now standard in every Titan deal.", publishedDate: "Nov 2023" },
      { title: "Titan Legal Group Advises on $2.3B Acquisition of Midwest Manufacturing Conglomerate", url: "https://www.businesswire.com/titan-legal-manufacturing-acquisition", source: "Business Wire", mediaType: "press_release", description: "Titan Legal Group announces its role as lead counsel on the $2.3B acquisition of a Midwest manufacturing group, with Managing Partner Patricia Monroe leading the M&A and regulatory teams through a complex antitrust review.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Joshua", lastName: "Stern",
    insights: [
      { title: "Patent Strategy for AI Companies: The Questions Founders Should Be Asking Now", url: "https://techcrunch.com/2024/02/patent-strategy-ai-joshua-stern", source: "TechCrunch", mediaType: "article", description: "Joshua Stern walks AI founders through the IP questions that determine whether their technology moat is defensible — from patentable AI architecture choices to the trade secret protections that may matter more than patents.", publishedDate: "Feb 2024" },
      { title: "Why your AI startup's IP strategy is probably wrong", url: "https://www.linkedin.com/posts/joshua-stern-ip", source: "LinkedIn", mediaType: "linkedin_post", description: "Joshua's direct post on the three IP mistakes he sees most consistently in AI company formation — and the early decisions that are much harder to fix retroactively once a company has investors and customers.", publishedDate: "Jan 2024" },
      { title: "The Tech IP Podcast — Trade Secrets vs. Patents: When to Choose What", url: "https://open.spotify.com/episode/5vRrTrWvOsRrJd5P0ZlNpV", source: "Spotify", mediaType: "podcast", description: "Joshua joins the Tech IP podcast for a practical breakdown of the trade-off between patent protection and trade secret strategy for software companies — covering disclosure timing, international considerations, and the employee departure risk.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Ren", lastName: "Tanaka",
    insights: [
      { title: "The Infrastructure Layer AI Is Missing — and Why We're Building It", url: "https://techcrunch.com/2024/01/ai-infrastructure-ren-tanaka", source: "TechCrunch", mediaType: "article", description: "Ren Tanaka explains the infrastructure gap that motivated the founding of NeuroLink AI — the training orchestration, checkpoint management, and compute efficiency problems that every frontier lab is solving in-house and none of the cloud providers have productized.", publishedDate: "Jan 2024" },
      { title: "NeurIPS 2023 — Efficient Large Model Training: Systems Lessons from the Research-to-Production Gap", url: "https://www.youtube.com/watch?v=fI9vTxZbMoD", source: "YouTube", mediaType: "video", description: "Ren's NeurIPS systems workshop on the engineering realities of large model training — the failure modes, the checkpoint strategies, and the distributed training optimizations that separate research experiments from production runs.", publishedDate: "Dec 2023" },
      { title: "AI Infrastructure Podcast — Ep. 29: The Hidden Cost of Model Training", url: "https://open.spotify.com/episode/6wSsTrWvPsRsKe6P1ZmOpW", source: "Spotify", mediaType: "podcast", description: "Ren discusses the compute economics behind frontier model training, the utilization rates that make or break unit economics, and why he believes the infrastructure layer will consolidate around a small number of purpose-built platforms.", publishedDate: "Nov 2023" },
      { title: "NeuroLink AI Raises $47M Series A to Build the AWS for Model Training", url: "https://www.businesswire.com/neurolink-ai-series-a", source: "Business Wire", mediaType: "press_release", description: "NeuroLink AI announces a $47M Series A led by Sequoia, with CTO and Co-Founder Ren Tanaka outlining the company's vision to become the infrastructure backbone for the next generation of AI labs.", publishedDate: "Feb 2024" },
      { title: "Every AI lab is solving the same infrastructure problems. That's a market.", url: "https://www.linkedin.com/pulse/ai-infrastructure-market-ren-tanaka", source: "LinkedIn", mediaType: "linkedin_post", description: "Ren's founding thesis post — why the fragmented, bespoke training infrastructure at every AI lab is not a sign of differentiation but of a tooling market waiting to be standardized.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Chloe", lastName: "Park",
    insights: [
      { title: "Attention Mechanism Efficiency: A Practitioner's Guide to What Actually Works", url: "https://towardsdatascience.com/attention-efficiency-chloe-park", source: "Towards Data Science", mediaType: "article", description: "Chloe Park cuts through the attention efficiency literature to assess what techniques are practically deployable at production scale — flash attention variants, sparse attention trade-offs, and the benchmarking methodology her team uses.", publishedDate: "Mar 2024" },
      { title: "ICLR 2024 — Adaptive Compute Allocation for Mixture-of-Experts Models", url: "https://www.youtube.com/watch?v=gJ0uUyZbNoE", source: "YouTube", mediaType: "video", description: "Chloe's ICLR presentation on NeuroLink's research into dynamic compute routing for MoE architectures — the training stability challenges, the routing collapse mitigation strategies, and benchmark results against dense baseline models.", publishedDate: "May 2024" },
      { title: "My reading list for ML engineers who want to understand inference optimization", url: "https://www.linkedin.com/posts/chloe-park-ml", source: "LinkedIn", mediaType: "linkedin_post", description: "Chloe's curated thread of papers, blog posts, and systems resources for ML engineers wanting to go deeper on inference optimization — organized by topic and annotated with her own notes on what's worth prioritizing.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Gregory", lastName: "Hall",
    insights: [
      { title: "The Digitization of Commercial Lines Underwriting: Where Are We Really?", url: "https://www.insurancejournal.com/digitization-commercial-lines-gregory-hall", source: "Insurance Journal", mediaType: "article", description: "Gregory Hall provides an unvarnished assessment of where commercial lines digitization actually stands — the workflow automation that is delivering, the AI-assisted underwriting that still needs human oversight, and the data quality problems nobody wants to talk about.", publishedDate: "Jan 2024" },
      { title: "RIMS 2023 — Climate Risk and Commercial Property: How Underwriters Are Adapting", url: "https://www.youtube.com/watch?v=hK1wVwZbOoF", source: "YouTube", mediaType: "video", description: "Gregory's RIMS panel on how commercial property underwriting is evolving in response to climate risk — the cat model limitations, the secondary peril challenge, and the underwriting guideline changes Ironclad has implemented.", publishedDate: "Apr 2023" },
      { title: "The Insurance Podcast — Ep. 119: Building a Digital Underwriting Platform on Legacy Infrastructure", url: "https://open.spotify.com/episode/7xTtUrWvQsRtLf7P2ZnPpX", source: "Spotify", mediaType: "podcast", description: "Gregory joins The Insurance Podcast to discuss the multi-year effort to modernize Ironclad's underwriting platform — the build vs. buy decisions, the change management with tenured underwriters, and the measurable efficiency gains.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Tina", lastName: "Kowalski",
    insights: [
      { title: "Claims Automation in P&C: What's Working and What's Creating New Problems", url: "https://www.claims-journal.com/automation-pc-tina-kowalski", source: "Claims Journal", mediaType: "article", description: "Tina Kowalski provides a frank assessment of automation in P&C claims — where straight-through processing is delivering on its promise, where it's creating customer experience problems, and the human oversight model Ironclad uses to catch edge cases.", publishedDate: "Feb 2024" },
      { title: "We handle 3,000 claims a day across 12 offices. Here's how we keep quality consistent.", url: "https://www.linkedin.com/pulse/claims-quality-scale-tina-kowalski", source: "LinkedIn", mediaType: "linkedin_post", description: "Tina's operational breakdown of Ironclad's claims quality management system — the calibration process, the adjuster scorecard methodology, and the coaching program that reduced variance in settlement outcomes across offices.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Sam", lastName: "Adeyemi",
    insights: [
      { title: "The Case for Radical Simplicity in Enterprise UX", url: "https://uxdesign.cc/radical-simplicity-enterprise-sam-adeyemi", source: "UX Collective", mediaType: "article", description: "Sam Adeyemi argues that enterprise software is chronically over-featured and under-designed — and shares the design principles Vivid Studio uses to push back against feature bloat in client work, even when stakeholders push the other way.", publishedDate: "Feb 2024" },
      { title: "Config 2023 — Designing for Complexity Without Creating It", url: "https://www.youtube.com/watch?v=iL2xXwZbPoG", source: "YouTube", mediaType: "video", description: "Sam's Figma Config talk on the design process Vivid uses for complex enterprise products — stakeholder alignment techniques, design system governance, and the research methods that surface the real user problem beneath the stated feature request.", publishedDate: "Jun 2023" },
      { title: "Vivid Design Studio Named to Fast Company's Most Innovative Design Firms", url: "https://www.fastcompany.com/most-innovative-design-vivid-studio", source: "Fast Company", mediaType: "press_release", description: "Fast Company recognizes Vivid Design Studio as one of the most innovative design firms of 2024, citing its signature approach to enterprise UX and its work redesigning three products that collectively serve 2M+ daily active users.", publishedDate: "Mar 2024" },
      { title: "Design critique culture: how we give feedback that actually makes the work better", url: "https://medium.com/@sam-adeyemi-design/design-critique-culture", source: "Medium", mediaType: "blog_post", description: "Sam's guide to running design critiques that improve work without crushing designers — the facilitation structure, the feedback frameworks, and the culture norms Vivid has built over seven years of studio practice.", publishedDate: "Jan 2024" },
      { title: "Hot take: most design systems are solving the wrong problem", url: "https://www.linkedin.com/posts/sam-adeyemi-ux", source: "LinkedIn", mediaType: "linkedin_post", description: "Sam's provocative take on design system investment — why most organizations build systems optimized for design consistency when the actual bottleneck is the handoff to engineering, not the component library itself.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Diana", lastName: "Santos",
    insights: [
      { title: "The Sun Belt Real Estate Correction: What the Data Actually Shows", url: "https://fortune.com/2024/02/sun-belt-real-estate-diana-santos", source: "Fortune", mediaType: "article", description: "Diana Santos provides a data-driven assessment of Sun Belt commercial real estate after the rate-driven repricing — which submarkets have overcorrected, where fundamentals remain strong, and the asset classes HarbourView is actively acquiring.", publishedDate: "Feb 2024" },
      { title: "ULI Fall Meeting 2023 — Capital Markets in a Higher-for-Longer World", url: "https://www.youtube.com/watch?v=jM3yYwZbQoH", source: "YouTube", mediaType: "video", description: "Diana's ULI panel on how real estate investors are repositioning for a sustained higher-rate environment — the capitalization rate adjustments, the capital stack reconfigurations, and the asset types holding value.", publishedDate: "Oct 2023" },
      { title: "HarbourView Real Estate Closes $340M Value-Add Office-to-Residential Conversion Fund", url: "https://www.businesswire.com/harbourview-conversion-fund-close", source: "Business Wire", mediaType: "press_release", description: "HarbourView Real Estate closes its targeted office-to-residential conversion fund, with CIO Diana Santos identifying the regulatory momentum and structural housing shortage as the thesis behind the strategy.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Marco", lastName: "Reyes",
    insights: [
      { title: "What 10 Years of Construction Project Failures Taught Me About Risk", url: "https://www.linkedin.com/pulse/construction-risk-lessons-marco-reyes", source: "LinkedIn", mediaType: "linkedin_post", description: "Marco's candid post cataloguing the project risk patterns he has observed across $400M+ in construction — schedule slippage root causes, subcontractor management mistakes, and the due diligence steps that would have caught most of them.", publishedDate: "Nov 2023" },
      { title: "Data Center Construction: The Developer's Guide to a Specialized Asset Class", url: "https://www.constructiondive.com/data-center-construction-marco-reyes", source: "Construction Dive", mediaType: "article", description: "Marco walks through the unique construction management challenges for data center builds — power infrastructure coordination, critical system commissioning, and the schedule compression realities that developers underestimate.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Fiona", lastName: "Gallagher",
    insights: [
      { title: "HR Tech's Consolidation Era: What It Means for Buyers and Builders", url: "https://techcrunch.com/2024/01/hr-tech-consolidation-fiona-gallagher", source: "TechCrunch", mediaType: "article", description: "Fiona Gallagher analyzes the wave of HR tech M&A and platform consolidation — the buyer logic, the integration challenges that keep derailing them, and what the consolidation era means for mid-market buyers evaluating HRIS vendors.", publishedDate: "Jan 2024" },
      { title: "HR Tech Conference 2023 — Compliance as a Product Feature, Not an Afterthought", url: "https://www.youtube.com/watch?v=kN4zZwZbRoI", source: "YouTube", mediaType: "video", description: "Fiona's HR Tech keynote on CloudNine's philosophy of treating compliance automation as a first-class product capability — the engineering investment required, the customer ROI, and why most HR platforms still treat compliance as bolt-on.", publishedDate: "Oct 2023" },
      { title: "The Modern People Ops Podcast — Building HR Tech in a Category with 1,000 Vendors", url: "https://open.spotify.com/episode/8yUuVrWvRsRuMe8P3ZoPpY", source: "Spotify", mediaType: "podcast", description: "Fiona joins the Modern People Ops podcast to discuss how CloudNine differentiates in a crowded HR tech market — the ICP discipline, the product bets that proved right, and the competitor she respects most.", publishedDate: "Nov 2023" },
      { title: "The best thing we ever did was fire a customer. Here's why.", url: "https://www.linkedin.com/posts/fiona-gallagher-cloudnine", source: "LinkedIn", mediaType: "linkedin_post", description: "Fiona's honest post on the decision to exit a large enterprise customer whose requirements were pulling CloudNine's product away from its core market — and how the decision changed the team's thinking about ICP discipline.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Theo", lastName: "Anderson",
    insights: [
      { title: "The Customer Success Operating Model Most SaaS Companies Are Missing", url: "https://medium.com/@theo-anderson-cs/customer-success-operating-model", source: "Medium", mediaType: "blog_post", description: "Theo Anderson outlines the three CS operating model gaps he has seen across multiple HR SaaS companies — how coverage ratios, handoff processes, and success plan ownership are typically misconfigured, and what high-performing CS orgs do differently.", publishedDate: "Dec 2023" },
      { title: "We went from 60% to 92% net revenue retention in 18 months. Here's the full playbook.", url: "https://www.linkedin.com/pulse/nrr-turnaround-theo-anderson", source: "LinkedIn", mediaType: "linkedin_post", description: "Theo's detailed account of CloudNine's CS transformation — the segmentation model, the health score redesign, the QBR process overhaul, and the two initiatives that accounted for 70% of the NRR improvement.", publishedDate: "Jan 2024" },
      { title: "Gainsight Pulse 2023 — Digital CS at Scale: When to Use Tech and When to Use Humans", url: "https://www.youtube.com/watch?v=lO5aAxZbSoJ", source: "YouTube", mediaType: "video", description: "Theo's Pulse conference session on CloudNine's blended CS model — the digital programs that serve the long tail of smaller customers, the human-led coverage model for enterprise, and the signals that trigger human escalation.", publishedDate: "May 2023" },
    ],
  },
  {
    firstName: "Ivan", lastName: "Petrov",
    insights: [
      { title: "Building a Security-First Engineering Culture Without Slowing Down Shipping", url: "https://medium.com/@ivan-petrov-eng/security-first-culture", source: "Medium", mediaType: "blog_post", description: "Ivan documents the DevSecOps transformation at Ember Security — the shift-left practices, the developer security training program, and the tooling integrations that put security feedback directly in the PR review workflow.", publishedDate: "Jan 2024" },
      { title: "KubeCon 2023 — Container Security at Runtime: Beyond Static Scanning", url: "https://www.youtube.com/watch?v=mP6bBwZbToK", source: "YouTube", mediaType: "video", description: "Ivan's KubeCon talk on the limitations of static container image scanning and the runtime security approach Ember built — behavioral anomaly detection, eBPF-based visibility, and the alert tuning required to make runtime protection operationally viable.", publishedDate: "Nov 2023" },
      { title: "We acquired a startup. Here's what the security audit found.", url: "https://www.linkedin.com/posts/ivan-petrov-security", source: "LinkedIn", mediaType: "linkedin_post", description: "Ivan's post-acquisition security review lessons — the infrastructure debt patterns that showed up, the credential hygiene issues that were endemic, and the 90-day remediation playbook Ember runs on every acquired codebase.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Laura", lastName: "Chen",
    insights: [
      { title: "Precision Agriculture's Productivity Promise: What the Field Trials Actually Show", url: "https://www.farmprogress.com/precision-ag-trials-laura-chen", source: "Farm Progress", mediaType: "article", description: "Laura Chen presents multi-year field trial data on Verdant's precision farming platform — yield impacts across corn and soybean across soil types, the sensor configurations that matter most, and the on-farm conditions that limit technology adoption.", publishedDate: "Feb 2024" },
      { title: "Agricultural Data Science: The Messy Middle Between Research and Farm Practice", url: "https://medium.com/@laura-chen-agronomy/ag-data-science-messy-middle", source: "Medium", mediaType: "blog_post", description: "Laura's frank account of the gap between academic precision agriculture research and real farm deployment — the data quality issues, the connectivity constraints, and the agronomic knowledge required to make ML models that farmers actually trust.", publishedDate: "Nov 2023" },
      { title: "The one thing every agtech company underestimates about farmer adoption", url: "https://www.linkedin.com/posts/laura-chen-verdant", source: "LinkedIn", mediaType: "linkedin_post", description: "Laura's post on the trust and relationship dynamics that determine whether farmers actually use precision farming technology — and why the best technical solution frequently loses to the one with better agronomic support.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Felix", lastName: "Nguyen",
    insights: [
      { title: "BAFTA-Nominated Game Director Felix Nguyen on Why Narrative Games Are Having a Moment", url: "https://variety.com/2024/games-narrative-felix-nguyen", source: "Variety", mediaType: "article", description: "Felix discusses the cultural and technical factors converging to make narrative games a breakout category — longer play sessions, the solo play resurgence, and why Starlight's design philosophy of emotional resonance over replayability is paying off.", publishedDate: "Jan 2024" },
      { title: "GDC 2023 — Writing for Games: The Unique Grammar of Interactive Narrative", url: "https://www.youtube.com/watch?v=nQ7cCwZbUoL", source: "YouTube", mediaType: "video", description: "Felix's GDC session on the craft of interactive narrative writing — the branching structures that feel meaningful versus arbitrary, the player agency illusions that actually work, and the design of Starlight's most critically discussed story beat.", publishedDate: "Mar 2023" },
      { title: "The Game Dev Unchained Podcast — Staying Indie When the Acquisition Offers Come In", url: "https://open.spotify.com/episode/9zWwXrWvSsRvNf9P4ZqQpZ", source: "Spotify", mediaType: "podcast", description: "Felix joins Game Dev Unchained for an honest conversation about the acquisition approaches Starlight has fielded, how the team thinks about independence, and why he believes creative control is a business strategy as much as an artistic one.", publishedDate: "Sep 2023" },
    ],
  },
  {
    firstName: "Amber", lastName: "Collins",
    insights: [
      { title: "Procedural Generation That Doesn't Feel Procedural: Lessons from Starlight's World-Building", url: "https://www.gamedeveloper.com/procedural-generation-amber-collins", source: "Game Developer", mediaType: "article", description: "Amber Collins shares the technical and design approach behind Starlight's acclaimed world-building system — the authored rules that constrain procedural generation, the artist override layers, and the QA process for catching worlds that break narrative coherence.", publishedDate: "Feb 2024" },
      { title: "The code that almost shipped our game six months late (and what we did about it)", url: "https://www.linkedin.com/posts/amber-collins-gamedev", source: "LinkedIn", mediaType: "linkedin_post", description: "Amber's candid post on the engine architecture decision that created a performance crisis late in Starlight's last production cycle — how the team diagnosed it, the optimization sprint that resolved it, and the engineering post-mortem lessons.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Dr. Richard", lastName: "Nakamura",
    insights: [
      { title: "Rapid Diagnostics at the Point of Care: The Market Opportunity After COVID", url: "https://techcrunch.com/2024/02/rapid-diagnostics-market-richard-nakamura", source: "TechCrunch", mediaType: "article", description: "Dr. Nakamura maps the post-pandemic landscape for point-of-care diagnostics — where COVID expanded the market, where reimbursement is normalizing, and the clinical use cases Quantum is prioritizing for the next generation of rapid test platforms.", publishedDate: "Feb 2024" },
      { title: "J.P. Morgan Healthcare Conference 2024 — Quantum Diagnostics: Investor Presentation", url: "https://www.youtube.com/watch?v=oR8dDwZbVoM", source: "YouTube", mediaType: "video", description: "Dr. Nakamura presents Quantum's clinical pipeline and commercial strategy at the J.P. Morgan Healthcare Conference — the regulatory pathway for two pipeline products, the partnership model with hospital systems, and the 2024 revenue outlook.", publishedDate: "Jan 2024" },
      { title: "Quantum Diagnostics Receives FDA Clearance for Rapid Sepsis Biomarker Panel", url: "https://www.businesswire.com/quantum-diagnostics-fda-clearance", source: "Business Wire", mediaType: "press_release", description: "Quantum Diagnostics announces FDA 510(k) clearance for its rapid sepsis biomarker panel, enabling results in under 20 minutes at the point of care. CEO Dr. Richard Nakamura calls it the company's most consequential regulatory milestone.", publishedDate: "Mar 2024" },
      { title: "Physician scientists make the best diagnostics entrepreneurs. Here's my case.", url: "https://www.linkedin.com/pulse/physician-scientist-diagnostics-richard-nakamura", source: "LinkedIn", mediaType: "linkedin_post", description: "Dr. Nakamura's argument for why clinical training creates unique advantages in diagnostics company-building — the unmet need pattern recognition, the clinical validation instincts, and the physician network access that accelerates adoption.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Jasmine", lastName: "Ford",
    insights: [
      { title: "Embedded Analytics: The Engineering Trade-Offs No One Writes About", url: "https://medium.com/@jasmine-ford-eng/embedded-analytics-tradeoffs", source: "Medium", mediaType: "blog_post", description: "Jasmine Ford documents the architecture decisions behind Redwood's embedded analytics platform — the multi-tenancy isolation approaches, the query performance trade-offs at scale, and the customer customization requirements that create the most engineering complexity.", publishedDate: "Jan 2024" },
      { title: "Scaling from 5 to 60 Engineers: The Organizational Design That Actually Worked", url: "https://www.linkedin.com/pulse/engineering-org-scaling-jasmine-ford", source: "LinkedIn", mediaType: "linkedin_post", description: "Jasmine's retrospective on Redwood's engineering org growth — the team topology experiments, the squad model that didn't fit, the platform team investment that paid dividends, and what she would do differently.", publishedDate: "Nov 2023" },
      { title: "QCon London 2024 — Multi-Tenant Architecture at Scale: Lessons from Embedded Analytics", url: "https://www.youtube.com/watch?v=pS9eEwZbWoN", source: "YouTube", mediaType: "video", description: "Jasmine's QCon presentation on the multi-tenant architecture decisions that define Redwood's platform — the tenant isolation models, the noisy neighbor mitigations, and the schema-per-tenant approach that has aged better than expected.", publishedDate: "Mar 2024" },
    ],
  },
  {
    firstName: "Patrick", lastName: "O'Connor",
    insights: [
      { title: "The Sales Engineer's Playbook for Technical Evaluation Cycles", url: "https://www.linkedin.com/pulse/sales-engineer-playbook-patrick-oconnor", source: "LinkedIn", mediaType: "linkedin_post", description: "Patrick's detailed guide to running technical evaluations that close — how to structure POCs, manage evaluation criteria, and navigate the internal champion relationship that determines whether a technically successful POC converts to a deal.", publishedDate: "Feb 2024" },
      { title: "Why most software demos are a waste of everyone's time (and how to fix yours)", url: "https://medium.com/@patrick-oconnor-se/better-software-demos", source: "Medium", mediaType: "blog_post", description: "Patrick's critique of the standard SaaS product demo and a practical framework for discovery-led demonstrations that speak to the customer's actual use case rather than the product's feature set.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "Danielle", lastName: "Wright",
    insights: [
      { title: "Digital Transformation Still Fails 70% of the Time. Here's Why.", url: "https://hbr.org/2024/01/digital-transformation-failure-danielle-wright", source: "Harvard Business Review", mediaType: "article", description: "Danielle Wright's analysis of persistent digital transformation failure rates — the organizational factors that outweigh technology choices, the governance structures that predict success, and the interventions Atlas uses to diagnose root causes before beginning engagements.", publishedDate: "Jan 2024" },
      { title: "Management Consulted Podcast — Life After Partner: Building a Boutique Consulting Firm", url: "https://open.spotify.com/episode/0aTaYrWvTsRwOf0P5ZrRpA", source: "Spotify", mediaType: "podcast", description: "Danielle discusses her transition from Deloitte partner to building Atlas Consulting — the client base she prioritized, the talent model she built differently, and the engagements she now turns away that she would have taken at a large firm.", publishedDate: "Nov 2023" },
      { title: "The AI Transformation Blueprint: What Leaders Get Wrong and How to Get It Right", url: "https://medium.com/@danielle-wright-consulting/ai-transformation-blueprint", source: "Medium", mediaType: "blog_post", description: "Danielle's practical framework for enterprise AI adoption — the capability assessment, the pilot design principles, and the organizational change management elements that determine whether AI initiatives deliver business value or become expensive experiments.", publishedDate: "Feb 2024" },
      { title: "The client who fired us midway through the engagement — and what we learned", url: "https://www.linkedin.com/posts/danielle-wright-atlas", source: "LinkedIn", mediaType: "linkedin_post", description: "Danielle's rare and candid post on a failed consulting engagement — the diagnostic misalignment, the stakeholder dynamics that derailed progress, and the process changes Atlas made to identify engagement-threatening conditions earlier.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Connor", lastName: "Burke",
    insights: [
      { title: "Cloud Migration Without the Chaos: An Operator's Guide", url: "https://medium.com/@connor-burke-consulting/cloud-migration-guide", source: "Medium", mediaType: "blog_post", description: "Connor Burke's practical guide to enterprise cloud migration, written for the program managers and IT leaders managing the actual execution — covering wave planning, dependency mapping, and the runbook structures that prevent common go-live failures.", publishedDate: "Dec 2023" },
      { title: "I've been on 8 cloud migrations. Here's the one thing that determines success.", url: "https://www.linkedin.com/posts/connor-burke-atlas", source: "LinkedIn", mediaType: "linkedin_post", description: "Connor's post on the single organizational factor he has seen determine cloud migration outcomes more than any technical choice — and the early engagement questions he asks clients to assess it.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Helen", lastName: "Morrison",
    insights: [
      { title: "Supply Chain Visibility as a Product: The Architecture and Business Case", url: "https://www.productled.com/supply-chain-visibility-helen-morrison", source: "Product-Led Alliance", mediaType: "article", description: "Helen Morrison outlines the product decisions behind Meridian Systems' supply chain visibility platform — the data model for multi-tier visibility, the customer integration patterns, and the business case framework that has become the standard for their enterprise sales cycle.", publishedDate: "Feb 2024" },
      { title: "Mind the Product — Building Vertical SaaS for Industries That Don't Speak Tech", url: "https://www.youtube.com/watch?v=qT0fFwZbXoO", source: "YouTube", mediaType: "video", description: "Helen's Mind the Product talk on the product management challenges specific to deep vertical SaaS — domain expertise requirements, the customer advisory board model Meridian uses, and the product discovery techniques that work with supply chain practitioners.", publishedDate: "Oct 2023" },
      { title: "The CPO's journey: from generalist PM to executive product leader", url: "https://open.spotify.com/episode/1bBaZrWvUsRxPg1P6ZsSpB", source: "Spotify", mediaType: "podcast", description: "Helen joins the Product Leadership podcast to discuss the transition from senior IC product manager to CPO — the skills that transferred, the ones she had to develop, and how she thinks about building product teams that can operate autonomously.", publishedDate: "Jan 2024" },
      { title: "We cut our product roadmap in half. Revenue went up.", url: "https://www.linkedin.com/pulse/roadmap-reduction-helen-morrison", source: "LinkedIn", mediaType: "linkedin_post", description: "Helen's post on Meridian's radical roadmap simplification initiative — the process for identifying low-value features, the customer communication strategy, and why focus improved both engineering velocity and customer satisfaction simultaneously.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Captain Thomas", lastName: "Reid",
    insights: [
      { title: "Human Factors in Aviation Operations: What 28 Years in the Cockpit Taught Me About Managing Risk", url: "https://www.aviationweek.com/human-factors-operations-thomas-reid", source: "Aviation Week", mediaType: "article", description: "Thomas Reid applies Crew Resource Management principles to airline operations management — how the mindsets that prevent accidents in the cockpit translate to ground operations, maintenance planning, and the organizational decisions that create systemic risk.", publishedDate: "Jan 2024" },
      { title: "ATCA Annual — Integrating AI Dispatch Tools While Keeping Humans in Command", url: "https://www.youtube.com/watch?v=rU1gGwZbYoP", source: "YouTube", mediaType: "video", description: "Thomas's ATCA panel on BlueSky's experience deploying AI-assisted flight dispatch tools — the human-machine interface design decisions, the training program for dispatchers, and the non-normal scenario testing that revealed automation bias risks.", publishedDate: "Oct 2023" },
      { title: "What airline operations can teach any complex organization about resilience", url: "https://www.linkedin.com/posts/thomas-reid-aviation", source: "LinkedIn", mediaType: "linkedin_post", description: "Thomas's post drawing out the operational resilience principles from commercial aviation that apply broadly — the pre-mortem culture, the standard operating procedure discipline, and the readback-hearback communication norm that prevents the majority of errors.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Sandra", lastName: "Miles",
    insights: [
      { title: "The Airline CX Playbook: Why the Industry Keeps Getting It Wrong", url: "https://www.linkedin.com/pulse/airline-cx-playbook-sandra-miles", source: "LinkedIn", mediaType: "linkedin_post", description: "Sandra's pointed analysis of why airline customer experience consistently underdelivers — the structural incentives, the IT legacy constraints, and the staff empowerment failures that create the moments passengers remember for the wrong reasons.", publishedDate: "Jan 2024" },
      { title: "The Disruptors Podcast — Redesigning the Airport Experience from the Inside Out", url: "https://open.spotify.com/episode/2cCbArWvVsRyQh2P7ZtTpC", source: "Spotify", mediaType: "podcast", description: "Sandra joins The Disruptors to discuss BlueSky's airport experience redesign program — the journey mapping methodology, the cross-functional change management, and the two initiatives that moved NPS more than anything else they tried.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Dr. Ananya", lastName: "Krishnan",
    insights: [
      { title: "RNA Therapeutics: From Academic Promise to Clinical Reality", url: "https://www.statnews.com/2024/01/rna-therapeutics-clinical-ananya-krishnan", source: "STAT News", mediaType: "article", description: "Dr. Krishnan traces the scientific and regulatory arc of RNA therapeutics from the first approved siRNA to Helix's current clinical programs — the delivery vehicle breakthroughs, the manufacturing challenges, and the patient populations being prioritized.", publishedDate: "Jan 2024" },
      { title: "Helix Biotech Presents Positive Phase I Data at ASHG Annual Meeting", url: "https://www.businesswire.com/helix-biotech-ashg-phase-1-data", source: "Business Wire", mediaType: "press_release", description: "Helix Biotech presents encouraging Phase I safety and PK data for its lead RNA therapeutic candidate targeting a rare genetic liver disorder, with CEO Dr. Ananya Krishnan citing the tolerability profile as exceeding pre-clinical predictions.", publishedDate: "Nov 2023" },
      { title: "The Long Run — From MIT PI to Biotech CEO: The Unexpected Lessons", url: "https://open.spotify.com/episode/3dDcBrWvWsRzRi3P8ZuUpD", source: "Spotify", mediaType: "podcast", description: "Dr. Krishnan joins The Long Run for a wide-ranging conversation about founding Helix from her MIT lab — the principal investigator-to-CEO transition, the capital-raising journey from a non-traditional background, and her framework for scientific risk-taking.", publishedDate: "Sep 2023" },
      { title: "The science is the easy part. Here's what they don't teach you about building a biotech.", url: "https://www.linkedin.com/posts/ananya-krishnan-helix", source: "LinkedIn", mediaType: "linkedin_post", description: "Dr. Krishnan's honest post on the operational and leadership challenges of early-stage biotech that no PhD program prepares you for — fundraising psychology, board dynamics, and the hardest people decision she has had to make.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Marcus", lastName: "Webb",
    insights: [
      { title: "Negotiating Pharma Partnerships When You Have No Leverage: The Biotech BD Playbook", url: "https://medium.com/@marcus-webb-bd/pharma-partnership-playbook", source: "Medium", mediaType: "blog_post", description: "Marcus Webb lays out the framework for biotech companies negotiating their first big pharma partnership — how to establish leverage from data quality, the term sheet provisions that matter most, and the collaboration governance structures that protect scientific autonomy.", publishedDate: "Feb 2024" },
      { title: "Helix Biotech Enters Global License Agreement with Takeda for RNA Delivery Platform", url: "https://www.businesswire.com/helix-biotech-takeda-license", source: "Business Wire", mediaType: "press_release", description: "Helix Biotech announces a global license agreement with Takeda Pharmaceutical for rights to Helix's novel lipid nanoparticle delivery technology, with VP of Business Development Marcus Webb leading a deal that includes $45M upfront and up to $380M in milestones.", publishedDate: "Mar 2024" },
      { title: "Every biotech BD deal I've closed has had this in common", url: "https://www.linkedin.com/posts/marcus-webb-helix", source: "LinkedIn", mediaType: "linkedin_post", description: "Marcus's post on the one consistent factor across every successful pharma partnership he has negotiated — and the deal that almost failed because this element was missing until the final week.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Calvin", lastName: "Reeves",
    insights: [
      { title: "The Real Cost of Network Debt: A Telecom CTO's Reckoning", url: "https://www.lightreading.com/network-debt-calvin-reeves", source: "Light Reading", mediaType: "article", description: "Calvin Reeves quantifies the operational and strategic cost of legacy network infrastructure debt at Clearwave — the maintenance burden, the service limitation constraints, and the competitive disadvantage that drove the $800M fiber investment program.", publishedDate: "Jan 2024" },
      { title: "Fiber Broadband Association Annual 2023 — Network Slicing for Enterprise: Ready or Not?", url: "https://www.youtube.com/watch?v=sV2hHwZbZoQ", source: "YouTube", mediaType: "video", description: "Calvin's FBA panel on the readiness of network slicing capabilities for enterprise managed services deployment — the standards maturity, the operational tooling gaps, and how Clearwave is positioning its network architecture to capitalize on enterprise demand.", publishedDate: "Sep 2023" },
      { title: "Clearwave Telecom Completes Statewide Fiber Expansion, Reaches 500,000 Enterprise Passings", url: "https://www.prnewswire.com/clearwave-fiber-expansion-complete", source: "PR Newswire", mediaType: "press_release", description: "Clearwave Telecom announces the completion of its five-year fiber expansion program under CTO Calvin Reeves, reaching 500,000 enterprise-ready passings across Georgia, Alabama, and South Carolina.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Angela", lastName: "Moss",
    insights: [
      { title: "Selling Managed Services in a Price-Sensitive Market: The Value-Led Approach That Works", url: "https://www.linkedin.com/pulse/managed-services-value-selling-angela-moss", source: "LinkedIn", mediaType: "linkedin_post", description: "Angela's sales methodology post on shifting enterprise conversations from price comparison to TCO analysis — the business case framework Clearwave uses to quantify the value of fiber over alternatives and the stakeholder map that shapes the outreach strategy.", publishedDate: "Jan 2024" },
      { title: "SD-WAN Is Over. What Comes Next for Enterprise Connectivity.", url: "https://www.networkworld.com/enterprise-connectivity-next-angela-moss", source: "Network World", mediaType: "article", description: "Angela Moss asserts that SD-WAN's enterprise adoption cycle has peaked and maps the emerging connectivity priorities — SASE integration, deterministic latency for AI workloads, and the enterprise requirements that are driving Clearwave's product roadmap.", publishedDate: "Feb 2024" },
      { title: "The deal that taught me everything about enterprise sales", url: "https://medium.com/@angela-moss-sales/enterprise-sales-lesson", source: "Medium", mediaType: "blog_post", description: "Angela's detailed account of an 18-month enterprise deal that nearly collapsed four times — the multi-threaded relationship map that saved it, the procurement dynamics she hadn't encountered before, and the close sequence that got it over the line.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Richard", lastName: "Chandler",
    insights: [
      { title: "Community Banking's Competitive Playbook Against the Megabanks", url: "https://www.americanbanker.com/community-banking-playbook-richard-chandler", source: "American Banker", mediaType: "article", description: "Richard Chandler argues that regional banks have structural advantages over megabanks that are systematically underexploited — relationship depth, local decision-making, and the community investment positioning that builds durable deposit loyalty.", publishedDate: "Feb 2024" },
      { title: "ABA Annual Convention 2023 — Leading Through Two Recessions: What the Patterns Reveal", url: "https://www.youtube.com/watch?v=tW3iIwZbAoR", source: "YouTube", mediaType: "video", description: "Richard's ABA keynote drawing on 35 years of banking leadership through multiple credit cycles — the early warning indicators he monitors, the portfolio management disciplines that preserved capital, and the cultural factors that determined which banks recovered fastest.", publishedDate: "Oct 2023" },
      { title: "EastBridge Bank Completes Merger with First Colonial Financial, Creating $18B Regional Bank", url: "https://www.businesswire.com/eastbridge-first-colonial-merger", source: "Business Wire", mediaType: "press_release", description: "EastBridge Bank announces the completion of its strategic merger with First Colonial Financial, creating a combined institution with $18B in assets. Chairman and CEO Richard Chandler will lead the integration as part of a 36-month executive succession plan.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Christine", lastName: "Park",
    insights: [
      { title: "Model Risk Management in the Age of AI: What Bank Regulators Are Asking", url: "https://www.risk.net/model-risk-ai-christine-park", source: "Risk.net", mediaType: "article", description: "Christine Park surveys the evolving regulatory expectations for AI model risk management at banks — SR 11-7's limitations as a framework for LLMs, the documentation requirements examiners are adding, and the governance structures EastBridge has built.", publishedDate: "Mar 2024" },
      { title: "Risk Management Association Annual — Credit Risk in a Commercial Real Estate Correction", url: "https://www.youtube.com/watch?v=uX4jJwZbBoS", source: "YouTube", mediaType: "video", description: "Christine's RMA session on EastBridge's CRE exposure management strategy — the stress testing methodology, the office concentration limits the bank implemented ahead of the market turn, and the portfolio actions that reduced tail risk.", publishedDate: "Nov 2023" },
      { title: "The risk I worry about that no one else in banking is talking about", url: "https://www.linkedin.com/posts/christine-park-crm", source: "LinkedIn", mediaType: "linkedin_post", description: "Christine's post flagging an emerging risk category she sees growing in the banking sector — not the obvious credit or rate risk, but the concentration of operational dependency on a small number of critical technology providers.", publishedDate: "Feb 2024" },
    ],
  },
  {
    firstName: "Alexei", lastName: "Sorokin",
    insights: [
      { title: "Real-Time Payment Infrastructure: The Engineering Decisions That Determine Who Wins", url: "https://medium.com/@alexei-sorokin-payments/rtp-infrastructure", source: "Medium", mediaType: "blog_post", description: "Alexei Sorokin documents the distributed systems architecture behind Volga's real-time settlement engine — the consistency models, the idempotency guarantees, and the failure recovery patterns required to handle $5B in daily payment volume with sub-second finality.", publishedDate: "Jan 2024" },
      { title: "Money 20/20 Europe 2023 — PSD3 and the Open Banking Opportunity for Infrastructure Players", url: "https://www.youtube.com/watch?v=vY5kKwZbCoT", source: "YouTube", mediaType: "video", description: "Alexei's Money 20/20 talk on how PSD3's evolution reshapes the opportunity landscape for payments infrastructure companies — the API standardization implications, the new liability framework, and Volga's positioning for the next regulatory cycle.", publishedDate: "Jun 2023" },
      { title: "We process 2M transactions a day with 99.999% uptime. Here's the stack.", url: "https://www.linkedin.com/posts/alexei-sorokin-volga", source: "LinkedIn", mediaType: "linkedin_post", description: "Alexei's technical transparency post on Volga's infrastructure stack — the databases, the message brokers, the deployment model, and the incident that forced the architectural change that made the five-nines target achievable.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Lena", lastName: "Fischer",
    insights: [
      { title: "PSD2's Unfinished Business: What PSD3 Must Fix for Open Banking to Reach Its Potential", url: "https://techcrunch.com/2024/01/psd3-open-banking-lena-fischer", source: "TechCrunch", mediaType: "article", description: "Lena Fischer assesses PSD2's implementation gaps and makes the case for the PSD3 provisions that would actually deliver on open banking's promise — better SCA consistency, liability clarity, and the API performance standards that have been left to national interpretation.", publishedDate: "Jan 2024" },
      { title: "RegTech Summit London 2023 — GDPR Meets PSD2: Managing the Intersection for Fintech Compliance", url: "https://www.youtube.com/watch?v=wZ6lLwZbDoU", source: "YouTube", mediaType: "video", description: "Lena's RegTech Summit presentation on the compliance architecture Volga built to satisfy GDPR, PSD2, and AML requirements simultaneously — where the frameworks conflict, the legal basis decisions that matter most, and the governance model for ongoing regulatory change.", publishedDate: "Oct 2023" },
    ],
  },
  {
    firstName: "James", lastName: "Harper",
    insights: [
      { title: "Documentary in the Streaming Era: What the Business Model Change Means for the Art Form", url: "https://variety.com/2024/documentary-streaming-james-harper", source: "Variety", mediaType: "article", description: "James Harper examines how streaming platforms' appetite for documentary content has reshaped production — the commission dynamics, the editorial independence trade-offs, and why he believes the form is in a golden era despite the business pressures.", publishedDate: "Feb 2024" },
      { title: "BAFTA Television Craft Awards — Accepting the Best Documentary Series Award", url: "https://www.youtube.com/watch?v=xA7mMwZbEoV", source: "YouTube", mediaType: "video", description: "James accepts ArcLight's BAFTA for Best Documentary Series, delivering a short speech about the access journalism and the four-year production journey behind the film — and the subject who almost pulled out on day 300.", publishedDate: "Apr 2023" },
      { title: "The pitch that changed how I think about documentary storytelling", url: "https://www.linkedin.com/posts/james-harper-arclight", source: "LinkedIn", mediaType: "linkedin_post", description: "James's reflective post on a commission pitch that failed — and how the feedback reshaped his approach to structuring documentary proposals, particularly around the narrative arc and the access plan.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Colonel Michael", lastName: "Barnes",
    insights: [
      { title: "The Defense Industry's AI Readiness Gap: A Practitioner's Assessment", url: "https://www.defenseone.com/ai-readiness-defense-michael-barnes", source: "Defense One", mediaType: "article", description: "Michael Barnes surveys the gap between AI capability and operational readiness across defense programs — the data infrastructure bottlenecks, the acquisition model limitations, and the cultural barriers to deploying AI in mission-critical contexts.", publishedDate: "Feb 2024" },
      { title: "AUSA Annual Meeting 2023 — Autonomous Systems in Multi-Domain Operations: Policy and Reality", url: "https://www.youtube.com/watch?v=yB8nNwZbFoW", source: "YouTube", mediaType: "video", description: "Michael's AUSA panel on the policy frameworks governing autonomous systems in military operations — the Rules of Engagement compatibility questions, the verification and validation requirements, and the acquisition pathways that are accelerating fielding.", publishedDate: "Oct 2023" },
      { title: "SkyForge Defense Awarded $180M DoD Contract for Autonomous Systems Integration", url: "https://www.businesswire.com/skyforge-defense-dod-contract", source: "Business Wire", mediaType: "press_release", description: "SkyForge Defense announces a $180M Department of Defense contract for autonomous systems integration services, led by VP of Defense Programs Colonel (ret.) Michael Barnes and involving SkyForge's proprietary sensor fusion and command-and-control architecture.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Alicia", lastName: "Kim",
    insights: [
      { title: "Checkout Conversion in the Headless Commerce Era: What the Data Shows", url: "https://www.emarketer.com/checkout-conversion-headless-alicia-kim", source: "eMarketer", mediaType: "article", description: "Alicia Kim analyzes checkout conversion benchmarks across Neon Commerce's client base, identifying the headless implementation decisions that correlate with higher completion rates and the common pitfalls that introduce unexpected friction.", publishedDate: "Jan 2024" },
      { title: "ShopTalk 2024 — The Future of Fulfillment: When Customer Expectations Meet Operational Reality", url: "https://www.youtube.com/watch?v=zA9oOwZbGoX", source: "YouTube", mediaType: "video", description: "Alicia's ShopTalk session on the fulfillment experience gap — the customer expectations set by Amazon, the unit economics reality most DTC brands face, and the fulfillment promise strategies that deliver satisfaction without destroying margins.", publishedDate: "Mar 2024" },
      { title: "The DTC feature that looked great in testing and bombed in production", url: "https://www.linkedin.com/posts/alicia-kim-neon", source: "LinkedIn", mediaType: "linkedin_post", description: "Alicia's honest post on a product launch that didn't land despite strong usability testing — the gap between test conditions and actual customer behavior, and the discovery process that revealed what was really happening.", publishedDate: "Dec 2023" },
    ],
  },
  {
    firstName: "Raj", lastName: "Pillai",
    insights: [
      { title: "Order Management at 50K Orders Per Day: The Architecture That Got Us There", url: "https://medium.com/@raj-pillai-eng/order-management-architecture", source: "Medium", mediaType: "blog_post", description: "Raj documents the evolution of Neon Commerce's order management system from a simple Shopify integration to a distributed, event-driven architecture handling peak-day loads — including the production incident that exposed the original design's limits.", publishedDate: "Nov 2023" },
      { title: "Event-Driven Architecture for E-commerce: When It's Worth the Complexity", url: "https://www.youtube.com/watch?v=aB0pPwZbHoY", source: "YouTube", mediaType: "video", description: "Raj's engineering conference talk on the e-commerce use cases where event-driven architecture delivers genuine value versus where it introduces unnecessary complexity — with concrete examples from Neon's production system.", publishedDate: "Sep 2023" },
      { title: "The on-call incident that changed how our team thinks about observability", url: "https://www.linkedin.com/posts/raj-pillai-neon", source: "LinkedIn", mediaType: "linkedin_post", description: "Raj's post on a production incident that took 6 hours to resolve because the team was flying blind — the observability investments Neon made afterward and the incident review process that turned it into a system improvement.", publishedDate: "Jan 2024" },
    ],
  },
  {
    firstName: "Vivienne", lastName: "Laurent",
    insights: [
      { title: "Luxury Brand in a Digital World: Why Heritage and Innovation Aren't Opposites", url: "https://skift.com/2024/02/luxury-brand-digital-vivienne-laurent", source: "Skift", mediaType: "article", description: "Vivienne Laurent makes the case that digital transformation and luxury brand equity are complementary rather than in tension — tracing how Terrace Hotels has used digital personalization to amplify its service philosophy rather than commoditize it.", publishedDate: "Feb 2024" },
      { title: "NYU Hospitality Investment Conference 2023 — Rebranding Boutique Hotels: The Art of Not Overcomplicating It", url: "https://www.youtube.com/watch?v=bC1qQwZbIoZ", source: "YouTube", mediaType: "video", description: "Vivienne's NYUHIC talk on the rebranding methodology behind Terrace's most successful repositioning — the research process, the visual identity evolution, and the staff culture components of brand that most hotel rebrands ignore.", publishedDate: "Jun 2023" },
      { title: "Terrace Hotels Named to Condé Nast Traveler's Gold List for the Third Consecutive Year", url: "https://www.prnewswire.com/terrace-hotels-gold-list-2024", source: "PR Newswire", mediaType: "press_release", description: "Terrace Hotels earns its third consecutive Gold List recognition from Condé Nast Traveler, with Chief Brand Officer Vivienne Laurent crediting a brand-led culture initiative that embedded service design principles into every guest touchpoint.", publishedDate: "Jan 2024" },
      { title: "The worst rebranding mistake I've made — and what I'd do differently", url: "https://www.linkedin.com/pulse/rebranding-mistake-vivienne-laurent", source: "LinkedIn", mediaType: "linkedin_post", description: "Vivienne's candid post on a hotel repositioning that overcorrected — the market research misread, the visual identity that alienated the core guest, and the pivot process that recovered the property's performance.", publishedDate: "Nov 2023" },
    ],
  },
  {
    firstName: "Samuel", lastName: "Knight",
    insights: [
      { title: "Dynamic Pricing in Hospitality: The Revenue Manager's Framework for Getting It Right", url: "https://www.hotelmanagement.net/dynamic-pricing-samuel-knight", source: "Hotel Management", mediaType: "article", description: "Samuel Knight shares the revenue optimization philosophy behind Terrace's 23% RevPAR increase — the pricing algorithm governance model, the demand signal weighting, and the rate parity disciplines that prevent the channel conflicts that undermine most dynamic pricing programs.", publishedDate: "Mar 2024" },
      { title: "HSMAI Revenue Optimization Conference 2023 — Total Revenue Management: Moving Beyond Room Rate", url: "https://www.youtube.com/watch?v=cD2rRwZbJoA", source: "YouTube", mediaType: "video", description: "Samuel's HSMAI keynote on Terrace's total revenue management approach — how the team applies yield management discipline to F&B, spa, and meeting space in addition to rooms, and the data infrastructure that makes cross-department optimization possible.", publishedDate: "Oct 2023" },
      { title: "The pricing decision that cost us $2M (and the framework we built because of it)", url: "https://www.linkedin.com/pulse/pricing-decision-lesson-samuel-knight", source: "LinkedIn", mediaType: "linkedin_post", description: "Samuel's transparent post on a rate strategy miscalculation during a high-demand period — the competitive intelligence failure, the forecast model assumption that was wrong, and the revenue management governance changes Terrace implemented afterward.", publishedDate: "Jan 2024" },
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

  let totalSeeded = 0;
  for (const { firstName, lastName, insights } of INSIGHTS_BY_NAME) {
    const [contact] = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(and(eq(contactsTable.firstName, firstName), eq(contactsTable.lastName, lastName)))
      .limit(1);

    if (!contact) continue;

    const [{ existing }] = await db
      .select({ existing: sql<number>`count(*)::int` })
      .from(contactInsightsTable)
      .where(eq(contactInsightsTable.contactId, contact.id));

    if (existing > 0) continue;

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
    totalSeeded += insights.length;
  }
  if (totalSeeded > 0) {
    console.log(`Seeded ${totalSeeded} new insights.`);
  } else {
    console.log("Insights already up to date.");
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
