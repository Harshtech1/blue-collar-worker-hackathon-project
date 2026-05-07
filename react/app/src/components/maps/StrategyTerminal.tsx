import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  Zap,
  Cpu,
  Brain,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  History,
  Shield,
  Radio,
  Activity,
  ArrowRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  time: string;
  source: 'SYNC' | 'RF_MODEL' | 'LLM_GROQ' | 'SYSTEM' | 'EXECUTION';
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'strategy';
}

interface DecisionRecord {
  id: string;
  timestamp: string;
  strategy: string;
  zoneId: string;
  status: 'executed' | 'pending' | 'rejected';
  outcome?: string;
}

interface StrategyTerminalProps {
  isExpanded: boolean;
  onToggle: () => void;
  teamMembers: { status: string; totalEarnings: number; totalJobs: number }[];
  currentStrategy?: string;
  onExecuteStrategy?: (zoneId: string) => void;
}

const COLORS = {
  bg: '#020617',
  emerald: '#10b981',
  amber: '#f59e0b',
  rahiIndigo: '#6366f1',
  glassBg: 'rgba(2, 6, 23, 0.85)',
  glassBorder: 'rgba(99, 102, 241, 0.3)',
  recording: '#ef4444',
};

const generateInitialLogs = (): LogEntry[] => [
  { id: '1', time: '00:00:01', source: 'SYSTEM', message: 'LOGISTICS_CORE_AUDIT initialized. Waiting for data stream...', type: 'info' },
  { id: '2', time: '00:00:02', source: 'SYNC', message: 'Geospatial mesh synchronized. Agra sector topology loaded.', type: 'info' },
  { id: '3', time: '00:00:03', source: 'RF_MODEL', message: 'Random Forest v4.2: Training complete. Model accuracy: 94.7%', type: 'success' },
  { id: '4', time: '00:00:04', source: 'LLM_GROQ', message: 'Groq inference engine online. Context window: 128K tokens', type: 'info' },
  { id: '5', time: '00:00:05', source: 'SYSTEM', message: 'STRICT_PERSISTENCE mode: ACTIVE. All decisions will be logged.', type: 'warning' },
];

const sampleStrategy = `Analyzing workforce allocation across Agra sectors... 

Based on demand surge patterns detected in Sector 4 (Civil Lines), we recommend redeploying 3 workers from Sector 1 (Idle) to intercept the 23% spike in AC repair requests.

Expected ROI: +₹12,400 in next 4 hours.
Risk Assessment: LOW. Worker load remains within safe threshold.

EXECUTE STRATEGY: AGRA_SECTOR_4_INTERCEPT?`;

export default function StrategyTerminal({ 
  isExpanded, 
  onToggle, 
  teamMembers,
  currentStrategy,
  onExecuteStrategy
}: StrategyTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>(generateInitialLogs);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'history'>('logs');
  const [typingIndex, setTypingIndex] = useState(0);
  const [displayedStrategy, setDisplayedStrategy] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [executingZone, setExecutingZone] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const strategyText = currentStrategy || sampleStrategy;

  useEffect(() => {
    if (isTyping && typingIndex < strategyText.length) {
      const timeout = setTimeout(() => {
        setDisplayedStrategy(strategyText.slice(0, typingIndex + 1));
        setTypingIndex(prev => prev + 1);
      }, 15);
      return () => clearTimeout(timeout);
    } else if (isTyping && typingIndex >= strategyText.length) {
      setIsTyping(false);
    }
  }, [isTyping, typingIndex, strategyText]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startTypingStrategy = useCallback(() => {
    setDisplayedStrategy('');
    setTypingIndex(0);
    setIsTyping(true);
    addLog('LLM_GROQ', 'Initiating strategic analysis...', 'info');
  }, []);

  const addLog = (source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { id: Date.now().toString(), time, source, message, type }]);
  };

  const executeStrategy = (zoneId: string) => {
    setExecutingZone(zoneId);
    setShowExecuteConfirm(true);
    
    addLog('EXECUTION', `DEPLOYING STRATEGY TO ${zoneId}...`, 'warning');
    
    setTimeout(() => {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 500);
      
      addLog('SYSTEM', `Strategy deployed to ${zoneId}. Monitoring outcomes...`, 'success');
      addLog('SYNC', `Worker assignment protocol initiated. ETA: 45 seconds.`, 'info');
      
      const decision: DecisionRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        strategy: 'Sector Intercept',
        zoneId,
        status: 'executed',
        outcome: 'Deployed'
      };
      setDecisions(prev => [decision, ...prev.slice(0, 4)]);
      
      setShowExecuteConfirm(false);
      setExecutingZone(null);
    }, 1500);
  };

  const simulateAnalysis = () => {
    startTypingStrategy();
    setTimeout(() => {
      addLog('RF_MODEL', 'Analyzing demand density patterns...', 'info');
    }, 1000);
    setTimeout(() => {
      addLog('RF_MODEL', 'Surge detected: Sector 4 +23% AC repair demand', 'warning');
    }, 2000);
    setTimeout(() => {
      addLog('LLM_GROQ', 'Computing optimal worker allocation...', 'strategy');
    }, 3000);
    setTimeout(() => {
      addLog('SYSTEM', 'Strategy recommendation ready for execution.', 'success');
    }, 5000);
  };

  return (
    <motion.div 
      animate={{ 
        y: 0, 
        scale: screenShake ? 1.02 : 1,
        transition: { duration: 0.1 }
      }}
      className={cn(
        "fixed left-16 right-0 bottom-0 border-t-2 z-[950] transition-all duration-300",
        isExpanded ? 'h-[320px]' : 'h-[48px]'
      )}
      style={{ 
        background: COLORS.glassBg,
        borderColor: isRecording ? `${COLORS.emerald}40` : COLORS.glassBorder,
        boxShadow: isRecording ? `0 -4px 30px ${COLORS.emerald}15` : 'none'
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .terminal-scroll::-webkit-scrollbar { width: 4px; }
        .terminal-scroll::-webkit-scrollbar-track { background: rgba(2, 6, 23, 0.5); }
        .terminal-scroll::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 2px; }
        .typewriter-cursor::after { content: '▋'; animation: blink 0.8s step-end infinite; color: #22d3ee; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .recording-pulse { animation: recording-pulse 1.5s ease-in-out infinite; }
        @keyframes recording-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 #ef444480; } 50% { opacity: 0.8; box-shadow: 0 0 0 6px #ef444400; } }
        .execute-flash { animation: flash-border 0.3s ease-out; }
        @keyframes flash-border { 0% { border-color: #ef4444; } 100% { border-color: #6366f1; } }
      `}</style>

      {/* Header */}
      <div 
        className="h-12 flex items-center justify-between px-4 cursor-pointer hover:bg-white/5 border-b"
        style={{ borderColor: COLORS.glassBorder }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-bold tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              LOGISTICS_CORE_AUDIT [STRICT_PERSISTENCE]
            </span>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 recording-pulse"></div>
                <span className="text-red-400 text-xs font-bold tracking-widest">RECORDING</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-zinc-500 text-xs">LLM STRATEGIC REASONING ONLINE</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('logs'); }}
              className={cn(
                "px-3 py-1 text-xs rounded transition-colors",
                activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              LIVE LOGS
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('history'); }}
              className={cn(
                "px-3 py-1 text-xs rounded transition-colors flex items-center gap-1",
                activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <History className="h-3 w-3" />
              RECALL ({decisions.length})
            </button>
          </div>
          
          <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
            {logs.length} EVENTS
          </Badge>
          
          <Button 
            size="sm" 
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); simulateAnalysis(); }}
            className="text-amber-400 hover:bg-amber-400/10"
          >
            <Brain className="h-3 w-3 mr-1" />
            ANALYZE
          </Button>
          
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="h-[calc(100%-48px)] flex"
          >
            {/* Main Terminal Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'logs' ? (
                <>
                  {/* Strategy Brief Panel */}
                  <div className="flex-shrink-0 p-3 border-b" style={{ borderColor: COLORS.glassBorder }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-cyan-400" />
                      <span className="text-cyan-400 text-xs font-bold tracking-wider">STRATEGIC BRIEF</span>
                      {isTyping && <span className="text-xs text-zinc-500 animate-pulse">Generating...</span>}
                    </div>
                    <div 
                      className="text-xs text-zinc-300 leading-relaxed max-h-20 overflow-y-auto terminal-scroll"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {displayedStrategy || (
                        <span className="text-zinc-600 italic">
                          Click ANALYZE to generate strategic recommendation...
                        </span>
                      )}
                      {isTyping && <span className="typewriter-cursor"></span>}
                    </div>
                    {!isTyping && displayedStrategy && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button 
                          size="sm"
                          onClick={() => executeStrategy('AGRA_SECTOR_4')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          EXECUTE STRATEGY: AGRA_SECTOR_4
                          <ArrowRight className="h-3 w-3 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Live Logs */}
                  <div className="flex-1 overflow-y-auto p-3 terminal-scroll">
                    {logs.map((log) => (
                      <motion.div 
                        key={log.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-start gap-3 py-1 text-xs"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        <span className="text-zinc-600 shrink-0 w-20">{log.time}</span>
                        <span className={cn(
                          "shrink-0 w-20 font-bold",
                          log.source === 'SYNC' && 'text-blue-400',
                          log.source === 'RF_MODEL' && 'text-purple-400',
                          log.source === 'LLM_GROQ' && 'text-cyan-400',
                          log.source === 'SYSTEM' && 'text-zinc-400',
                          log.source === 'EXECUTION' && 'text-amber-400'
                        )}>
                          [{log.source}]
                        </span>
                        <span className={cn(
                          log.type === 'success' && 'text-emerald-400',
                          log.type === 'warning' && 'text-amber-400',
                          log.type === 'error' && 'text-red-400',
                          log.type === 'strategy' && 'text-cyan-400 data-glow',
                          log.type === 'info' && 'text-zinc-300',
                          !log.type && 'text-zinc-300'
                        )}>
                          {log.message}
                        </span>
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </>
              ) : (
                /* History Tab */
                <div className="flex-1 overflow-y-auto p-4">
                  {decisions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <History className="h-12 w-12 mb-3 opacity-50" />
                      <p className="text-sm">No decision history yet</p>
                      <p className="text-xs mt-1">Execute strategies to build audit trail</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {decisions.map((decision) => (
                        <motion.div
                          key={decision.id}
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="p-3 rounded border"
                          style={{ 
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderColor: COLORS.glassBorder
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-zinc-500" />
                              <span className="text-zinc-500 text-xs">{decision.timestamp}</span>
                            </div>
                            <Badge variant={decision.status === 'executed' ? 'default' : 'secondary'} 
                              className={decision.status === 'executed' ? 'bg-emerald-500' : 'text-xs'}>
                              {decision.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-white font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {decision.strategy}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            Zone: <span className="text-indigo-400">{decision.zoneId}</span>
                          </div>
                          {decision.outcome && (
                            <div className="text-xs text-emerald-400 mt-2">
                              ✓ {decision.outcome}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats Panel */}
            <div 
              className="w-64 border-l p-4 space-y-4 overflow-y-auto"
              style={{ borderColor: COLORS.glassBorder }}
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                  <Activity className="h-3 w-3" />
                  TEAM STATUS
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-500/20 rounded-lg p-2 text-center border border-emerald-500/30">
                    <div className="text-emerald-400 font-bold text-lg">
                      {teamMembers.filter(m => m.status === 'online').length}
                    </div>
                    <div className="text-xs text-zinc-500">Online</div>
                  </div>
                  <div className="bg-amber-500/20 rounded-lg p-2 text-center border border-amber-500/30">
                    <div className="text-amber-400 font-bold text-lg">
                      {teamMembers.filter(m => m.status === 'busy').length}
                    </div>
                    <div className="text-xs text-zinc-500">Busy</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <Zap className="h-3 w-3" />
                  TODAY'S REVENUE
                </div>
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  ₹{teamMembers.reduce((sum, m) => sum + (m.totalEarnings || 0), 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  JOBS COMPLETED
                </div>
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {teamMembers.reduce((sum, m) => sum + (m.totalJobs || 0), 0)}
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: COLORS.glassBorder }}>
                <div className="text-xs text-zinc-600 text-center">
                  <Shield className="h-4 w-4 mx-auto mb-1 opacity-50" />
                  STRICT_PERSISTENCE<br/>Audit Trail Active
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execute Confirmation Modal */}
      <AnimatePresence>
        {showExecuteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]"
            onClick={() => setShowExecuteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-panel rounded-lg p-6 max-w-sm text-center"
              style={{ background: COLORS.glassBg, border: `1px solid ${COLORS.amber}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Radio className="h-8 w-8 text-amber-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                DEPLOYING STRATEGY
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                Executing to: <span className="text-amber-400 font-bold">{executingZone}</span>
              </p>
              <div className="flex items-center justify-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400 animate-spin" />
                <span className="text-emerald-400 text-sm">Confirming with Black Box...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}