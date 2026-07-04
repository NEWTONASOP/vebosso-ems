# VEBOSSO EMS - Testing Guide

This guide is split into two parts:
1. **The Live Coordination Script**: A step-by-step workflow for all 3 people to test the app simultaneously, verifying real-time data and interactions.
2. **Individual Role Checklists**: A clear summary of everything each person needs to test.

---

## 🎭 PART 1: The Live Coordination Script (Simultaneous Testing)
*Sit together (or on a call) and follow these steps sequentially.*

### Act 1: Setup & First Logins
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 1 | **Owner** | Log in as `VB-0001`. Go to **Settings > Add Member**. Create a Manager and a Member. | Accounts created. |
| 2 | **Owner** | Go to **Team**. Edit the new Member's profile to assign them to the Manager. | Member is assigned. |
| 3 | **Manager & Member** | Log in with new credentials. | Both hit the **Forced Password Change** screen. |
| 4 | **Manager & Member** | Change your password and log in. | Successfully logged in to respective dashboards. |
| 5 | **Member** | Go to **Profile** and change your password voluntarily. | Password changes successfully. |

### Act 2: The Daily Check-in & Real-time Stats
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 6 | **Owner** | Stay on the **Dashboard** screen. Keep an eye on the "Pending Approvals" stat. | Just observing. |
| 7 | **Member** | On Home screen, submit a **Daily Check-in** with a plan. | Status says "Pending Approval". |
| 8 | **Owner** | Look at your Dashboard. | "Pending Approvals" instantly increases. |
| 9 | **Manager** | Go to **Approvals**. Reject the check-in and type a reason. | Check-in rejected. |
| 10 | **Member** | Refresh/Check Home screen. | Status is Rejected. Reason is visible. |
| 11 | **Member** | Submit a new, updated check-in. | Status is "Pending Approval". |
| 12 | **Manager** | Go to **Approvals** and Approve the new check-in. | Check-in Approved. |
| 13 | **Member** | Verify Home screen. | You are actively checked in. |

### Act 3: Tasks & Push Notifications
*(Requires physical phones for Push Notifications)*
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 14 | **Member** | Put the app in the background (go to phone home screen). | App is backgrounded. |
| 15 | **Manager** | Go to **Tasks**. Create a task and assign it to the Member. | Task created. |
| 16 | **Member** | Look at your phone notifications. | You received a Push Notification. |
| 17 | **Member** | Tap notification (or open app). Go to Tasks, complete it, and add notes. | Task marked complete. |
| 18 | **Manager** | Look at the Task. | Task is Completed and you can read the notes. |

### Act 4: Leave Requests Hierarchy
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 19 | **Member** | Go to **Leaves**. Apply for a leave. | Leave is Pending. |
| 20 | **Manager** | Go to **Approvals (Leaves)**. Approve the leave. | Leave is Approved. |
| 21 | **Manager** | Go to your own **Leaves** tab. Apply for a leave. | Leave is Pending. |
| 22 | **Owner** | Go to **Approvals (Leaves)**. Approve the Manager's leave. | Leave is Approved. |

### Act 5: Targeted Announcements
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 23 | **Owner** | Create announcement for **"All Users"**. | Manager & Member both see it. |
| 24 | **Owner** | Create announcement for **"Managers"**. | Manager sees it. Member DOES NOT see it. |
| 25 | **Owner** | Create announcement for **"Specific User"** (select the Member). | Member sees it. Manager DOES NOT see it. |

### Act 6: Check-out & Edge Cases
| Step | Who | Action | Expected Result |
|---|---|---|---|
| 26 | **Member** | Submit **Check-out** report. | Status pending check-out. |
| 27 | **Manager** | Approve the Check-out. | Member is checked out. |
| 28 | **All 3** | Turn off Wi-Fi/Data. | **Offline Banner** appears. Try to do an action, it fails. |
| 29 | **All 3** | Turn Wi-Fi/Data back on. | **Offline Banner** disappears. |
| 30 | **Owner** | Go to **Session Management** or Member's profile. Force Logout the Member. | Member is automatically kicked to login screen. |
| 31 | **Owner** | Delete the Member's account completely. | Member cannot log back in. |

---

## 📋 PART 2: Individual Role Checklists
*A summary of everything each person is responsible for checking. Use this to ensure you didn't miss anything during the live coordination.*

### 👑 Owner Checklist
*(Your job is managing the company, assigning roles, and watching real-time stats)*
- [ ] Add Manager and Member accounts
- [ ] Edit a Member's profile (assign their Manager)
- [ ] Verify Dashboard stats update in real-time without refreshing
- [ ] Approve a Manager's leave request
- [ ] Test the 3 types of Announcements (All, Managers, Specific User)
- [ ] Test Force Logout on an active user (Deactivate account toggle)
- [ ] Test logging out a specific individual Session from the member's profile
- [ ] Delete a user account

### 👔 Manager Checklist
*(Your job is managing your team's daily flow and tasks)*
- [ ] First login Forced Password Change
- [ ] Reject a check-in with a reason
- [ ] Approve a check-in
- [ ] Create and assign a Task
- [ ] Verify Member completed task with notes
- [ ] Approve a check-out
- [ ] Approve a Member's leave request
- [ ] Submit your own leave request
- [ ] Search for a Member in the "My Team" tab
- [ ] Verify you see "All" and "Manager Only" announcements
- [ ] Verify Offline banner when internet is off

### 🧑‍💻 Member Checklist
*(Your job is performing daily work, applying for leave, and checking restrictions)*
- [ ] First login Forced Password Change
- [ ] Test Voluntary Password Change from your Profile tab
- [ ] Submit a check-in
- [ ] Read a check-in rejection reason, then resubmit
- [ ] Receive a push notification for a new task (app in background)
- [ ] Complete a task and add completion notes
- [ ] Submit a check-out
- [ ] Submit a leave request
- [ ] Verify you ONLY see "All" and "Specific User" announcements (NOT Manager announcements)
- [ ] Verify Offline banner when internet is off
- [ ] Experience being Force Logged Out by the Owner
- [ ] Verify you cannot log in after your account is deleted
