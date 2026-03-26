import React from 'react';
import { 
  Server, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Globe,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const SystemTab: React.FC = () => {
  const services = [
    { name: 'Core API Gateway (Express)', status: 'healthy', latency: '24ms', uptime: '99.99%' },
    { name: 'MongoDB Database Cluster', status: 'healthy', latency: '12ms', uptime: '100%' },
    { name: 'Real-time WebSocket (Socket.io)', status: 'healthy', latency: '8ms', uptime: '99.95%' },
    { name: 'Authentication Store (JWT)', status: 'healthy', latency: '18ms', uptime: '99.99%' },
    { name: 'Image Handling (Cloudinary)', status: 'healthy', latency: '145ms', uptime: '99.90%' },
    { name: 'Notification Service (SMTP)', status: 'healthy', latency: '85ms', uptime: '99.80%' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Cpu size={14} /> Server Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">Node.js Engine</div>
            <p className="text-xs font-bold text-green-600 mt-1">FRAMEWORK: EXPRESS</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Database size={14} /> Storage Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">MongoDB Atlas</div>
            <p className="text-xs font-bold text-blue-600 mt-1">NATIVE DRIVER • REPLICA SET</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShieldCheck size={14} /> Security Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-600">ENFORCED</div>
            <p className="text-xs font-bold text-slate-500 mt-1">JWT AUTH • BCRYPT HASHING</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Microservices Health
            </CardTitle>
            <button className="flex items-center gap-2 text-[10px] font-black uppercase bg-white border px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all">
              <RefreshCw size={12} /> Force Infrastructure Sync
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Service Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Uptime</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Latency</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((service, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                      <div className="flex items-center gap-2">
                        {service.name.includes('DB') ? <Database size={14} className="text-blue-500" /> : <Globe size={14} className="text-slate-400" />}
                        {service.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-600">{service.uptime}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{service.latency}</td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase",
                        service.status === 'healthy' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", service.status === 'healthy' ? "bg-green-500" : "bg-yellow-500")}></div>
                        {service.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
               <Cpu size={16} /> Server Runtime Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="bg-slate-900 rounded-lg p-4 font-mono text-[10px] text-green-400 space-y-1">
                <p><span className="text-slate-500">[12:37:01]</span> <span className="text-blue-400">INFO:</span> Express Server initialized on PORT 5000</p>
                <p><span className="text-slate-500">[12:37:05]</span> <span className="text-blue-400">INFO:</span> MongoDB Cluster connected successfully</p>
                <p><span className="text-slate-500">[12:38:12]</span> <span className="text-blue-400">INFO:</span> Socket.io namespaces and handlers mounted</p>
                <p><span className="text-slate-500">[12:40:02]</span> <span className="text-yellow-400">WARN:</span> SMTP service taking 1.2s for email dispatch</p>
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
               <HardDrive size={16} /> Data Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                      <span>Sync Integrity</span>
                      <span>100%</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className="bg-green-500 h-full rounded-full w-full" />
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                      <span>Backup Frequency</span>
                      <span>Daily (24h)</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className="bg-blue-500 h-full rounded-full w-[85%]" />
                   </div>
                </div>
                <button className="w-full mt-4 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:border-primary hover:text-primary transition-all">
                   Run Manual System Snapshot
                </button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
