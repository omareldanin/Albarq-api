# Al Barq API

## Features

### Report receipts

`GET /api/v1/reports/:reportID/receipt/pdf` returns a printable Arabic A5 portrait
PDF for an existing `CLIENT`, `BRANCH`, `DELIVERY_AGENT`, `COMPANY`, or `REPOSITORY`
report. Authenticate using the normal Bearer token or JWT cookie.

The receipt displays the report company’s saved logo at the top right (when available)
and the report-ID QR at the top left and again at the bottom. It includes رقم الكشف، التاريخ، نوع الكشف، العميل/الفرع/المندوب/الشركة/المخزن،
المتجر، ساحب الكشف، إجمالي عدد الطلبات، عدد طلبات بغداد، عدد طلبات المحافظات، والمبلغ المستحق بالدينار العراقي.
The date is the report creation time in Baghdad; ساحب الكشف is the original creator.
The QR code contains only the decimal report ID (for example `123`), so scanning it
can open the corresponding report in the frontend. The store row appears only on client
receipts, with `-` if the client report has no store. Client receipts also show
نوع البريد as واصل (`DELIVERED`) or راجع (`RETURNED`). Total orders equals the saved
Baghdad count plus the saved province count. PDF rendering waits for the logo to load.

Returned (`RETURNED`) receipts hide the amount-due section and keep all order counts.
Counts and amounts come from the saved report. Amount due follows the existing
report PDF: `clientNet` for clients and repositories, `branchNet` for branches,
and `companyNet` for companies and delivery agents (the amount the agent settles
with the company, rather than the agent's commission).

`POST /api/v1/reports` still returns the full report PDF and now also returns
browser-readable `X-Report-ID` and `X-Report-Receipt-URL` response headers. After
creation, the frontend can fetch that URL with authentication, open the PDF blob,
and print it. Existing reports can use their ID from the report list.

```sh
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/reports/123/receipt/pdf" \
  --output report-123-receipt.pdf
```

The response uses `Content-Type: application/pdf`,
`Content-Disposition: inline; filename="report-123-receipt.pdf"`, and
`Cache-Control: private, no-store`. Administrators can access all reports;
company managers and main-repository staff are scoped to their company. Clients
and authorized client assistants can access their client's reports; delivery
agents can access their own reports. Other staff are scoped by branch, with
repository staff also scoped to their repository for repository receipts.
Missing, deleted, and out-of-scope reports return 404. Invalid IDs and unsupported
report types return 400; unauthorized roles or missing access context return 403.

No database migration or new dependency is required. The standard static asset
copy includes the receipt template and embedded Arabic font.

```sh
node --test -r ts-node/register/transpile-only spec/reportReceipts.test.ts
```

### Receiving-agent report delivery

`PATCH /api/v1/reports/:reportID/deliver` records delivery of a client report.
Use the report ID from its receipt QR and authenticate as an active `RECEIVING_AGENT`
in the same company. Prior assignment is not required: the first successful delivery
sets `clientReport.agent` (stored as `receivingAgentId`) to the authenticated employee.
Only client reports support this operation.
Omit the request body or send `{}`; custom delivery, agent, payment, confirmation,
or timestamp fields are rejected.

```sh
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/reports/123/deliver"
```

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "status": "UNPAID",
    "confirmed": false,
    "delivered": true,
    "deliveredAt": "2026-11-04T12:00:00.000Z",
    "clientReport": {
      "receivingAgentId": 20,
      "agent": {"id": 20, "name": "مندوب الاستلام"}
    }
  }
}
```

Delivery records the authenticated agent through the existing client-report relation
and the server time; it does not write or return `deliveredBy`. Payment status, client
confirmation, order statuses, and balances remain unchanged. Repeated or concurrent
calls preserve the first delivery record and return 200. Report list and detail
responses also include `delivered`, `deliveredAt`, `clientReport.receivingAgentId`,
and `clientReport.agent` (id/name). A retry, including one by a different receiving
agent in the company, leaves the original agent and timestamp intact.

Missing authentication returns 401; other roles or invalid agent/company context
return 403, including deleted employees or employees whose current role/company
no longer matches their token. Invalid IDs or a nonempty body return 400. Missing,
deleted, other-company, and non-client reports return 404.

The database must have the `Report.delivered` and `Report.deliveredAt` fields from
the Prisma schema. Sync those fields using the project's database deployment workflow
before running this version, then regenerate Prisma (`npm run prisma:generate`).

```sh
node --test -r ts-node/register/transpile-only spec/reportDelivery.test.ts
```

### Employee wallets

Company and branch managers can manage employee wallets through `/api/v1/employee-wallets`.
Company managers with `showTreatury` can access their company's wallets; branch managers can only access their own branch.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/employee-wallets` | Create a wallet |
| GET | `/employee-wallets` | List wallets, with `page`, `size` (1–100), `branch_id`, and `employee_id` filters |
| GET | `/employee-wallets/:walletID` | Get a wallet and its transaction count |
| PATCH | `/employee-wallets/:walletID` | Update wallet fields |
| DELETE | `/employee-wallets/:walletID` | Delete a wallet without transaction history |
| GET | `/employee-wallets/:walletID/transactions` | List linked, non-deleted transactions; accepts `page`, `size`, `type`, and `approved=true/false` |

Create/update requests accept JSON or multipart form fields:

```json
{
  "employeeID": 20
}
```

On creation, the branch is taken from the authenticated user; `employeeID` is optional,
and all balances default to zero in the database. Company and creator are taken from authentication.
The branch must belong to the company; an assigned employee must be active and belong to that branch.
`employeeID: null` clears the assignment. Multiple wallets per employee are allowed by the model.

`total`, `paid`, and `pending` are read-only in this module. Create/update requests accept only
`employeeID` and reject balance and branch fields. This module does not post or link transactions.
PATCH changes the employee assignment and preserves the wallet branch. Wallets with any transaction history cannot be reassigned or deleted (409).
Unknown or inaccessible wallets return 404. Lists return `status`, `data`, `page`, `count`, and `pagesCount`.

The wallet migration is `20261101000000_add_employee_wallets`. Apply it using the project's normal
`npm run prisma:deploy` workflow before serving these endpoints; then run `npm run prisma:generate`.
This migration only adds wallet tables/relations and does not alter existing transaction enum values.

Run the database-free regression tests with:

```sh
node --test -r ts-node/register/transpile-only spec/employeeWallets.test.ts
```

## Links

## Technology Stack

The backend API is built using the following technologies and modules:

-   Node.js - JavaScript runtime environment.
-   Express - Web application framework for Node.js.
-   TypeScript - Static typing for JavaScript.
-   PostgreSQL - Relational database.
-   Prisma - ORM for database access and modeling.
-   JWT - JSON Web Tokens for authentication.
-   Bcrypt - Password hashing.
-   Zod - Data validation.
-   CORS - Enable CORS for API access.
-   Helmet - Security middleware.
-   Swagger - API documentation.
-   ESLint - Linter.
-   Prettier - Code formatter.

## Getting Started

To set up the development environment for the backend API, follow these steps:

### Prerequisites

-   [PostgreSQL](https://www.postgresql.org/)
-   [Node.js](https://nodejs.org/en/)

### Installation Steps

1. Clone the repository from GitHub to your local machine:

```
git clone https://github.com/alikehel/albarq-api-express.git
```

2. Navigate into the project directory:

```
cd albarq-api-express
```

3. Install dependencies:

```
yarn
```

4. Rename `.example.env` to `.env` and update the environment variables to match your local setup:

```
PORT=
NODE_ENV=""
JWT_SECRET=""
JWT_EXPIRES_IN=""
SECRET=""
DATABASE_URL=""
AWS_S3_BUCKET=""
AWS_PROFILE=""
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

5. Run the Postgres database if not already running.

6. Create the database specified in `.env` if it doesn't exist:

```
createdb albarq
```

7. Run database migrations if the project has them to setup schema.

8. Start the Node.js application:

```
npm start
```

9. The API should now be running on `http://localhost:3000` or the port defined in code.

10. Test API endpoints.

## Development Roadmap

The project is currently under development, and the following tasks are being worked on:

-   [ ] Improve Error Handling
-   [ ] Improve Input Validation Messages
-   [ ] Improve the UI and the Landing Page
-   [ ] Improve the Database Design
-   [ ] Improve API Swagger Documentations
-   [ ] Improve API Security Best Practices
-   [ ] Implement Pricing System
-   [ ] Implement Jest Testing
-   [ ] Implement JWT Refresh Tokens
-   [ ] Implement CI/CD with CircleCI / GitHub Actions
-   [ ] Implement the Chat System
-   [ ] Implement API Logging for Better Debugging
-   [ ] Refactor to Cleaner Code
-   [ ] Integrate with AWS services
-   [ ] Move from Prisma to Drizzle-ORM for better performence and less abstractions
-   [ ] API versioning and Caching
-   [ ] Try artillery or k6 for load testing

## Contributing

### Non-substantive changes

For any minor updates to the curriculum, such as fixing broken URLs, correcting spelling or syntax errors, and other non-substantive issues, we welcome you to submit a pull request. You can do this by following the guidelines in [pull request guide](https://www.freecodecamp.org/news/how-to-make-your-first-pull-request-on-github-3/).

### Substantive changes

If you have specific and substantial feedback or concerns about the content, we encourage you to open an issue. Please refer to [open an issue](https://help.github.com/articles/creating-an-issue/) for assistance.

## License

This project is licensed under the [MIT License](LICENSE).

### Wallet transaction filters

`GET /employee-wallets/:walletID/transactions` supports `start_date` and `end_date`
(`YYYY-MM-DD`, inclusive calendar days in Baghdad time), `target_branch_id`,
`target_client_id`, `type`, `approved`, `page`, and `size` (maximum 100).
Filters combine within the authorized wallet/company/branch scope. Responses include
`targetBranch` (id/name) and `targetClient` (id/user.name), and pagination counts
use the same filters. Wallet totals from `GET /employee-wallets/:walletID` remain
independent of transaction filters.

`GET /employee-wallets/:walletID/transactions/pdf` downloads an Arabic PDF of **all**
matching transactions with the same filters (except `page` and `size`). It includes
wallet details, current balances, the selected filters and repeated table headings.
It requires the same wallet permissions as the list and does not store the report
or change any balances. The client downloads it from the wallet details page.

### Employee personal wallet

Employees open **محفظتي** (`/wallet`) from the sidebar; login routing is unchanged.
`GET /employee-wallets/mine` returns wallets assigned to the authenticated employee
in their company, with an empty array when none are assigned. Multiple assignments
can be selected in the client. Deleted employees cannot access wallet data.

Personal transaction list endpoints use `/employee-wallets/mine/:walletID/transactions`
and `/transactions/pdf` with the same transaction filters as the management page.
`/employee-wallets/mine/:walletID/filters` returns destination options only from
that wallet's nondeleted transactions. Every wallet-specific request verifies
ownership before reading data. Management CRUD remains restricted to managers.

Employees can create transactions with `POST /employee-wallets/mine/:walletID/transactions`.
Accepted types: `DEPOSIT`, `WITHDRAW`, `FROM_BRANCH`, `TO_BRANCH`, `FROM_CLIENT`, `TO_CLIENT`.
Supply a nonempty `for` description and positive finite `paidAmount`. Branch movements
require `targetBranchId`; client movements require `targetClientId`; unrelated target
fields are rejected. `/employee-wallets/mine/:walletID/targets?kind=branch|client&search=...`
provides searchable, paginated company targets (id/name only).

The server verifies wallet ownership and target company membership, rejects deleted
clients, derives company/branch/creator/employee IDs, and records `forWallets=true`
with both approval flags false. Creation runs in a serializable transaction and does
not recalculate wallet balances; balance accounting remains deferred.
