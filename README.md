<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">Accessibility Regression Checker (ARC) </h3>

  <p align="center">
    A toolchain to automate web accessibility regression checks.
    <br />
    <a href="">View Demo</a>
    ·
    <a href="">Report Bug</a>
    ·
    <a href="">Request Feature</a>
  </p>
</div>

<!-- ABOUT THE PROJECT -->
## About the Project

The Accessibility Regression Checker (ARC) is a database-backed toolchain for auditing and tracking web accessibility compliance using axe-core, Node.js, SQLite, and Puppeteer. While automated testing alone cannot resolve every barrier, ARC serves as an early warning system by highlighting new violations that require deeper manual reviews.

Because accessibility is a continuous process, websites should be audited on a regular schedule. Even a fully remediated site can introduce new issues as it evolves. ARC can run baseline scans (typically taken right after accessibility fixes) to capture a site’s current compliance level. Future scans compare against this baseline to detect any regressions. If new violations appear, ARC sends alerts, prompting stakeholders to initaite a thorough review and remediation by an accessibility expert.

### Built With
[![Node][Node.js]][Node-url]

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites:

* Install npm:
  ```sh
  npm install npm@latest -g
  ```

### Installation:

* Clone the repository:
  ```sh
  git clone repo-url
  ```

* Navigate to the project directory:
  ```sh
  cd accessibilities-checker
  ```

* Install dependencies:
  ```sh
  npm install
  ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

### Running Locally:

Run `scan-website.js` with or without the `--baseline` flag.
- With `--baseline`: Saves detected barriers to the database as a baseline.
- Without `--baseline`: Compares new barriers to the baseline and logs results.

Baseline Scan (run after latest accessibility remediations have been completed):
```sh
node inspections/scan-website.js https://example.com --baseline
```

Scan (run regularly to check for any new accessibility barriers):
```sh
node inspections/scan-website.js https://example.com
```

## Alerts & Configuration

The webhook-server.js script helps integrate ARC with external platforms, such as CRMs, email services, or Slack.

### Inbound (Scan Requests):

External tools can send a POST request to the /webhook endpoint with:
- url: The website URL to scan.
- isBaseline: Whether the scan should be a baseline scan (true) or a regular scan (false).

Example Request

```sh
curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -H "x-auth-token: <your-secret-token>" \
     -d '{"url": "https://example.com", "isBaseline": true}'
```
### Outbound (Regression Notifications):

By default, ARC sends regression data to the /regression endpoint after each comparison. This payload can be forwarded to any external service that accepts JSON (e.g., Slack, email, CRMs):
- Slack: Use a Slack Incoming Webhook URL to post violation details to a channel.
- Email: Configure a backend script (e.g., Nodemailer) to forward the JSON payload via email.
- CRMs: Platforms like Salesforce, HubSpot, or GoHighLevel can trigger tasks, notifications, or other workflows using the POST data.

<p align="right">(<a href="#readme-top">back to top</a>)</p> <!-- HOW IT WORKS -->

<!-- HOW IT WORKS -->
## How It Works:

**axe-core** is an accessibility testing engine that runs within the browser to identify accessibility barriers on web pages, following WCAG guidelines and best practices.

**WCAG** (Web Content Accessibility Guidelines) is a set of internationally recognized standards for making web content more accessible to individuals with disabilities, ensuring equal access and usability for all users.

**Puppeteer** is used to programmatically launch a browser, navigate to the target website or local HTML file, inject the axe-core library, and execute accessibility analysis in the browser context.
### Key Features

- **Scanning and Comparison**:
    
    - **inspections/scan-website.js**: Scans websites or local HTML files for accessibility barriers.
        - **Baseline Scans**: Save detected barriers as a reference point for future comparisons.
        - **Non-Baseline Scans**: Compare scan results to the baseline, detecting regressions such as new WCAG violations.
    - **inspections/compare-baseline.js**: Identifies accessibility regressions by comparing barriers in the latest non-baseline scan with the baseline. Sends regression details to a webhook for alerts.
- **Notification System**:
    
    - **webhook-server.js**:
        - **Inbound**: Processes scan requests with URL and baseline parameters. Triggers `scan-website.js`.
        - **Outbound**: Sends notifications when regressions are detected, including details about new WCAG barriers.
- **Storage**:
    
    - **db/init.js**: Initializes an **SQLite** database for storing inspection metadata and barrier details.
        - **Inspections Table**: Tracks metadata such as scan type (baseline/non-baseline), URL, and environment.
        - **Barriers Table**: Stores details of detected barriers, including WCAG rules, impact, and affected user groups.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Julian De Los Prados - jad9679@nyu.edu

Project Link: [https://github.com/jdelosprados/accessibilities-checker](https://github.com/jdelosprados/accessibilities-checker)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[Node.js]: https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white
[Node-url]: https://nodejs.org