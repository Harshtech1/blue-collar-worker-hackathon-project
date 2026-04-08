import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  Edit, 
  Trash2, 
  Search,
  Calendar,
  DollarSign,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface TeamMember {
  id: string;
  worker_id: string;
  full_name: string;
  phone: string;
  email: string;
  rating: number;
  status: 'online' | 'offline' | 'busy';
  join_date: string;
  total_jobs: number;
  earnings: number;
  location: string;
  skills: string[];
  is_active: boolean;
  is_verified?: boolean;    // ✅ Aadhaar/ID verified flag
  aadhaar_url?: string;     // Document URL — presence = submitted
}

const ThekedarTeamManagement = () => {
  const { user, profile } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Form state for new team member
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    location: '',
    skills: '',
    join_date: new Date().toISOString().split('T')[0],
    worker_identifier: '' // email or phone
  });

  const fetchTeam = async () => {
    if (!user || profile?.role !== 'thekedar') return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/thekedar/team`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch team');
      
      const data = await response.json();
      setTeamMembers(data);
      setFilteredMembers(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [user, profile]);

  useEffect(() => {
    // Filter team members based on search term
    const filtered = teamMembers.filter(member =>
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.includes(searchTerm) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredMembers(filtered);
  }, [teamMembers, searchTerm]);

  const handleAddMember = async () => {
    if (!formData.worker_identifier) {
      toast.error('Worker identifier (phone/email) is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/thekedar/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ identifier: formData.worker_identifier })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add member');
      }

      toast.success('Worker added to your team!');
      fetchTeam();
      
      // Reset form and close dialog
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        location: '',
        skills: '',
        join_date: new Date().toISOString().split('T')[0],
        worker_identifier: ''
      });
      setIsDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleUpdateMember = () => {
    if (!editingMember) return;

    setTeamMembers(teamMembers.map(m => m.id === editingMember.id ? editingMember : m));
    setIsEditDialogOpen(false);
    setEditingMember(null);
  };

  const handleRemoveMember = (memberId: string) => {
    setTeamMembers(teamMembers.filter(m => m.id !== memberId));
  };

  const toggleMemberStatus = (memberId: string) => {
    setTeamMembers(teamMembers.map(member => 
      member.id === memberId 
        ? { 
            ...member, 
            status: member.status === 'online' ? 'offline' : 
                   member.status === 'offline' ? 'busy' : 'online' 
          } 
        : member
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">Manage your team members and their performance</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Enter details for the new team member to join your management group.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="worker_identifier">Worker Identifier (Phone or Email)</Label>
                <Input
                  id="worker_identifier"
                  value={formData.worker_identifier}
                  onChange={(e) => setFormData({...formData, worker_identifier: e.target.value})}
                  placeholder="Enter worker's registration phone or email"
                  className="border-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1 text-orange-600 dark:text-orange-400 font-medium">
                  Note: The worker must already have a RAHI account.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddMember} className="w-full sm:w-auto">Add to Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamMembers.filter(m => m.status === 'online').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Busy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamMembers.filter(m => m.status === 'busy').length}
            </div>
            <p className="text-xs text-muted-foreground">Working on jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamMembers.length > 0 
                ? (teamMembers.reduce((sum, m) => sum + m.rating, 0) / teamMembers.length).toFixed(1) 
                : '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">Team average</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No team members found</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first team member to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            {member.full_name.charAt(0)}
                          </div>
                          {/* Verification ring around avatar */}
                          {(member.is_verified || member.aadhaar_url) && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{member.full_name}</span>
                            {/* Inline verification badge */}
                            {(member.is_verified || member.aadhaar_url) ? (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                title="Identity Verified via Aadhaar"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Verified
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200"
                                title="Identity not yet verified"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                Unverified
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Joined {new Date(member.join_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${getStatusColor(member.status)}`}></div>
                        <span className="capitalize">{member.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          <span>{member.phone}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          <span>{member.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          <span>{member.rating.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          <span>{member.total_jobs} jobs</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3" />
                          <span>₹{member.earnings.toLocaleString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{member.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {member.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{member.skills.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleMemberStatus(member.id)}
                        >
                          {member.status === 'online' ? 'Go Offline' : 'Go Online'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingMember(member);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Team Member Dialog */}
      {editingMember && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>
                Update details for {editingMember.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input
                  id="edit_full_name"
                  value={editingMember.full_name}
                  onChange={(e) => setEditingMember({...editingMember, full_name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Phone Number</Label>
                <Input
                  id="edit_phone"
                  value={editingMember.phone}
                  onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember({...editingMember, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_location">Location</Label>
                <Input
                  id="edit_location"
                  value={editingMember.location}
                  onChange={(e) => setEditingMember({...editingMember, location: e.target.value})}
                  placeholder="Enter location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_rating">Rating</Label>
                <Input
                  id="edit_rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={editingMember.rating}
                  onChange={(e) => setEditingMember({...editingMember, rating: parseFloat(e.target.value) || 0})}
                  placeholder="Enter rating"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_total_jobs">Total Jobs</Label>
                <Input
                  id="edit_total_jobs"
                  type="number"
                  min="0"
                  value={editingMember.total_jobs}
                  onChange={(e) => setEditingMember({...editingMember, total_jobs: parseInt(e.target.value) || 0})}
                  placeholder="Enter total jobs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_earnings">Earnings (₹)</Label>
                <Input
                  id="edit_earnings"
                  type="number"
                  min="0"
                  value={editingMember.earnings}
                  onChange={(e) => setEditingMember({...editingMember, earnings: parseInt(e.target.value) || 0})}
                  placeholder="Enter earnings"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_status">Status</Label>
                <Select 
                  value={editingMember.status}
                  onValueChange={(value: 'online' | 'offline' | 'busy') => 
                    setEditingMember({...editingMember, status: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateMember}>Update Member</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ThekedarTeamManagement;