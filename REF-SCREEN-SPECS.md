# Reference Screen Specs (saved from screenshots)

## Screen 1 — Guard Console main overview (vms_guard_main_overview.png)
- Top bar: hamburger menu, "Guard Console", clock 09:42 AM, Thu, Aug 14 2026, bell icon with red badge "2", user avatar + "R. Sharma" dropdown
- KPI tiles (icon in blue circle ring + label + big numeral): Expected Today 48 (blue calendar icon), Checked In 12 (green check icon), In Premises 9 (blue people icon), Pending Check-out 3 (amber clock icon). Icon circle outline rings: Expected=blue, CheckedIn=green, InPremises=blue, Pending=amber/yellow.
- Left card: "Live Arrival Queue" (people icon, heading). Table columns Name/Purpose/Host/Time/Status. Rows: initials circle (AK blue ring? actually blue filled, MF purple filled, JO blue filled) + A. Kapoor / Client Meeting / S. Verma / 09:15 / CHECKED IN (green pill); M. Fernandez / Interview / HR / 09:30 / WAITING (amber pill); J. Okafor / Delivery / Facilities / 09:40 / WAITING (amber pill). Below table: "View Full Queue >" centered blue link.
- Right card: "ID Verification" (shield-person icon). Rounded photo card (gray-ish card with rounded photo). Right of photo: name "Marcos Fernandez", "Interview - HR Dept", divider, "Status", pill "AWAITING ID SCAN" (amber, full width), blue filled "Verify ID" button with ID card icon, red outline "Deny Entry" button with stop icon.
- Bottom: red banner, red shield-triangle icon, "WATCHLIST ALERT:" bold, "1 flagged visitor match today", chevron right.

## Screen 2 — Live Queue check-in flow (vms_guard_checkin_flow.png)
URL: vms.company.com/guard/queue/check-in. Top bar: Guard Console (no hamburger), clock, date, R. Sharma dropdown. Sidebar: Dashboard, Live Queue (active), Pre-Registered, Watchlist, Vehicles, Reports.
- Toast banner top center: green pill "Host notified: D. Kumar acknowledged arrival" with X.
- H1 "Visitor Check-In" with people icon, left column.
- Left card "Check-In Details" (blue heading): form rows each with icon + label + input: Full Name "Sarah Whitfield"; Company "Whitfield & Partners"; Purpose "Meeting with D. Kumar"; Host "D. Kumar - Floor 4"; Vehicle "KA 05 AB 1234 (parking slot B-12)" [SKIP — no vehicles in our VMS]; Badge type dropdown "Temporary - Day Pass". Inputs styled dark with rounded borders.
- Center card: large circular photo with GREEN RING border (thick green circle), below it green check circle icon + "Identity verified" green text. Below: 4-step progress tracker: numbered circles 1-4 connected by line; steps 1-3 green filled circles with green labels "Photo Done / ID Scan Done / Host Notified Done"; step 4 blue outlined circle "4" with label "Print Badge" + "Pending" (blue text).
- Right card: "Steps" label (blue) at top-left. Visitor badge (white rounded card): ACME corporate park logo (blue building) + "ACME / CORPORATE PARK", blue "VISITOR PASS" band, circular photo, name "Sarah Whitfield" dark, blue "Day Pass #2417", gray "Valid until 06:00 PM", QR code (white square). Below badge card: blue filled "Print Badge" button with printer icon (full width), "Cancel" outline/gray button (full width).

## Screen 3 — Pre-Registered view (vms_guard_preregistered_view.png)
- Sidebar: Dashboard, Live Queue, Pre-Registered (active), Watchlist, Vehicles, Reports
- Header top-right: filter chips row: "All", "Arriving Today 36", "Arrived 12", "Missed 2", "Late 4" + search box with search icon
- H1 "Pre-Registered Arrivals" + subtitle "28 visitors expecting to arrive today" (approx)
- Card grid 3 columns, each card: circular headshot photo (circle), name "A. Kapoor" bold, company "Whitfield & Partners", host line "Host: S. Verma", time row with clock icon "09:15 AM", status pill "ARRIVED" green / "WAITING" amber / "EXPECTED" blue; card bottom row: icons row (call, message, map-pin? small action icons)
- Right rail "Today at a Glance": "Arrivals 09:00-12:00 14", "Expected 12:00-17:00 22", "VIP Today 2", "Today's Schedule" list with time + name rows
- Bottom amber banner: "X visitors overdue from expected time" (amber warning pill/banner)

## Screen 4 — Watchlist & Alerts (vms_guard_watchlist_alert.png)
- Sidebar: Dashboard, Live Queue, Pre-Registered, Watchlist (active), Vehicles, Reports
- H1 "Watchlist & Alerts" + subtitle
- Left: "Flagged Visitor Matches" list; severity cards: HIGH (red left border or red tag) with visitor name, match reason (e.g. "Matched on watchlist"), location, timestamp; action buttons per card: "Dispatch Security" (red filled), "Notify Admin" (blue outline), "Dismiss" (gray outline)
- Bottom counts strip: "High N" (red chip), "Medium N" (amber chip), "Low 0" (green chip)
- Right: "Live CCTV Feed" card: placeholder with grid/TV icon, camera selector dropdown, LIVE red pill, "Record Clip" + "Full Screen" buttons
- Data source: visitors.is_blacklisted === true

## Data hooks available
- useGateStats(today) → {entered, inside, checkedOut, declined, noShow, awaitingApproval, overdue, overstaying}
- useTodayVisits(today) → ReportVisit[] with visitor/department/host joins; visit fields: status, checked_in_at, scheduled_for, created_at, purpose, photo_data, host.full_name, department.name, visitor.full_name, visitor.is_blacklisted
- VisitorCheckInFlow({ visit, onDone, onCancel }) — photo step + checkInScannedVisit; do not break

## Refined specs (from viewing images)

### Screen 3 detail
Filter chips: "All" (blue selected), "Arriving Today" + blue count badge 36, "Arrived" + green count 12, "Missed" + red count 2, "Late" + amber count 4. Search box right: magnifier + placeholder "Search visitor or host...".
H1 "Pre-Registered Arrivals" in Poppins bold, white. Cards 3-col grid: circular photo (circle), name bold, company subtitle, then "Host: S. Verma" row with person icon, then bottom row: clock icon + "09:15 AM" left, pill right (ARRIVED green fill, WAITING amber, EXPECTED blue). Cards dark surface with subtle border.
Right rail card: "Today at a Glance" heading with calendar icon. Rows: green people icon "Arrivals 09:00-12:00" + blue number 18; blue clock icon "Expected 12:00-17:00" + blue 18; amber star "VIP Today" + amber 3. Divider, "Today's Schedule" heading, rows: time (tabular) + name + small company subtitle + pill (ARRIVED/WAITING/EXPECTED). Footer blue link "View full schedule >".
Bottom banner: amber rounded card with amber left accent? Actually amber outline/border card: amber triangle icon + bold amber text "2 visitors overdue from expected time" + chevron right.

### Screen 4 detail
Watchlist sidebar item red-filled (active state blue for others). "Flagged Visitor Matches" heading with bell icon button at right. Cards: red left border + red shield icon + red heading "WATCHLIST MATCH - HIGH"; photo rounded square; name bold large "D. Mercer"; rows with icons: crosshair "Matched:" + red text "Blacklist - Trespass (12 Jul 2026)"; camera "CAM 02 - Main Lobby"; clock "09:38 AM"; three-dot menu top-right. Buttons row: red filled "Dispatch Security" (shield icon), blue outline "Notify Admin" (person icon), gray outline "Dismiss" (X icon).
Second card amber: "WATCHLIST MATCH - MEDIUM", "Restricted - Legal Hold" amber text, no location/time rows fully shown.
Bottom strip: red shield chip "High 1" red number, amber "Medium 1" amber number, green "Low 0" green number — separated chips.
Right card: "Live CCTV Feed" heading; top-right controls: dropdown "CAM 02 - Main Lobby" + gear icon. Feed area: large lobby photo (grayscale-ish/real photo), overlay top-left "CAM 02 - Main Lobby" tag, top-right red dot + "LIVE" pill. Bottom two buttons: "Record Clip" (red dot + text, outline), "Full Screen" (expand icon, outline).

### Screen 2 extra detail
Toast: green filled pill banner top-center "Host notified: D. Kumar acknowledged arrival" with green check icon and X.
"Visitor Check-In" H1 with people icon.
Check-In Details form: each row = icon (gray) + label + dark input field; fields Full Name, Company, Purpose, Host, (Vehicle SKIP), Badge type dropdown.
Center: circular photo w/ thick green ring; under photo green check-circle + "Identity verified" green text; step tracker 4 circles connected by green line (green filled 1-3, blue ring 4 pending); below: 4 columns labels "Photo/ID Scan/Host Notified/Print Badge" with Done green or Pending blue subtext.
Right: "Steps" blue label; white badge card with logo "ACME CORPORATE PARK", blue band "VISITOR PASS", circular photo, name, blue "Day Pass #2417", gray "Valid until 06:00 PM", QR; then blue Print Badge button, gray Cancel button.
