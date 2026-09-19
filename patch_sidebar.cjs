const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.jsx', 'utf8');

content = content.replace(/<<<<<<< HEAD\nimport { X, LayoutDashboard, LineChart, BookOpen, Activity, BarChart3, Edit, Target, MessageSquare, Server } from 'lucide-react';\n=======\nimport { X, LayoutDashboard, LineChart, BookOpen, Activity, BarChart3, Edit, Target, Server } from 'lucide-react';\n>>>>>>> origin\/main/g, "import { X, LayoutDashboard, LineChart, BookOpen, Activity, BarChart3, Edit, Target, MessageSquare, Server } from 'lucide-react';");

fs.writeFileSync('src/components/Sidebar.jsx', content);
