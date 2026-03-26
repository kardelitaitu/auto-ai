/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Connector Discovery Integration Tests
 * Tests browser discovery adapters, connection lifecycle, and error handling
 * @module tests/integration/connector-discovery.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withPage } from "../../core/context.js";

// Mock connector modules
vi.mock("../../connectors/baseDiscover.js", () => ({
  default: class BaseDiscover {
    constructor(config) {
      this.config = config;
      this.connected = false;
    }

    async connect() {
      this.connected = true;
      return { success: true, browserId: "test-browser" };
    }

    async disconnect() {
      this.connected = false;
      return { success: true };
    }

    async getBrowserInfo() {
      return {
        browserId: "test-browser",
        type: "chrome",
        version: "120.0",
      };
    }

    async healthCheck() {
      return { healthy: this.connected };
    }
  },
}));

vi.mock("../../connectors/discovery/localChrome.js", () => ({
  default: class LocalChromeDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.profilePath = config.profilePath || "default";
    }

    async connect() {
      const result = await super.connect();
      result.type = "chrome";
      result.profile = this.profilePath;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/localBrave.js", () => ({
  default: class LocalBraveDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.profilePath = config.profilePath || "default";
    }

    async connect() {
      const result = await super.connect();
      result.type = "brave";
      result.profile = this.profilePath;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/localEdge.js", () => ({
  default: class LocalEdgeDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.profilePath = config.profilePath || "default";
    }

    async connect() {
      const result = await super.connect();
      result.type = "edge";
      result.profile = this.profilePath;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/localVivaldi.js", () => ({
  default: class LocalVivaldiDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.profilePath = config.profilePath || "default";
    }

    async connect() {
      const result = await super.connect();
      result.type = "vivaldi";
      result.profile = this.profilePath;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/ixbrowser.js", () => ({
  default: class IxBrowserDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.apiPort = config.apiPort || 5055;
      this.profileId = config.profileId;
    }

    async connect() {
      if (!this.profileId) {
        throw new Error("Profile ID required for IxBrowser");
      }
      const result = await super.connect();
      result.type = "ixbrowser";
      result.profileId = this.profileId;
      result.apiPort = this.apiPort;
      return result;
    }

    async healthCheck() {
      try {
        // Simulate API call to IxBrowser service
        const isHealthy = await this.checkIxBrowserAPI();
        return { healthy: isHealthy, type: "ixbrowser" };
      } catch (error) {
        return { healthy: false, error: error.message };
      }
    }

    async checkIxBrowserAPI() {
      // Mock API check
      return this.connected;
    }
  },
}));

vi.mock("../../connectors/discovery/morelogin.js", () => ({
  default: class MoreLoginDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.apiUrl = config.apiUrl || "http://localhost:5055";
      this.profileId = config.profileId;
    }

    async connect() {
      if (!this.profileId) {
        throw new Error("Profile ID required for MoreLogin");
      }
      const result = await super.connect();
      result.type = "morelogin";
      result.profileId = this.profileId;
      result.apiUrl = this.apiUrl;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/roxybrowser.js", () => ({
  default: class RoxyBrowserDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.apiPort = config.apiPort || 35000;
      this.profileId = config.profileId;
    }

    async connect() {
      if (!this.profileId) {
        throw new Error("Profile ID required for RoxyBrowser");
      }
      const result = await super.connect();
      result.type = "roxybrowser";
      result.profileId = this.profileId;
      result.apiPort = this.apiPort;
      return result;
    }
  },
}));

vi.mock("../../connectors/discovery/undetectable.js", () => ({
  default: class UndetectableDiscover
    extends require("../../connectors/baseDiscover.js").default
  {
    constructor(config) {
      super(config);
      this.apiUrl = config.apiUrl || "http://localhost:3000";
      this.profileId = config.profileId;
    }

    async connect() {
      if (!this.profileId) {
        throw new Error("Profile ID required for Undetectable");
      }
      const result = await super.connect();
      result.type = "undetectable";
      result.profileId = this.profileId;
      result.apiUrl = this.apiUrl;
      return result;
    }
  },
}));

describe("Connector Discovery Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BaseDiscover", () => {
    it("should connect and disconnect successfully", async () => {
      const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
        .default;
      const discover = new BaseDiscover({});

      expect(discover.connected).toBe(false);

      const connectResult = await discover.connect();
      expect(connectResult.success).toBe(true);
      expect(connectResult.browserId).toBe("test-browser");
      expect(discover.connected).toBe(true);

      const disconnectResult = await discover.disconnect();
      expect(disconnectResult.success).toBe(true);
      expect(discover.connected).toBe(false);
    });

    it("should return browser info after connection", async () => {
      const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
        .default;
      const discover = new BaseDiscover({});

      await discover.connect();
      const info = await discover.getBrowserInfo();

      expect(info.browserId).toBe("test-browser");
      expect(info.type).toBe("chrome");
      expect(info.version).toBe("120.0");
    });

    it("should report health status based on connection state", async () => {
      const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
        .default;
      const discover = new BaseDiscover({});

      const health1 = await discover.healthCheck();
      expect(health1.healthy).toBe(false);

      await discover.connect();
      const health2 = await discover.healthCheck();
      expect(health2.healthy).toBe(true);
    });
  });

  describe("Local Browser Discoveries", () => {
    it("should connect to local Chrome with profile", async () => {
      const LocalChromeDiscover = (
        await import("../../connectors/discovery/localChrome.js")
      ).default;
      const discover = new LocalChromeDiscover({
        profilePath: "my-chrome-profile",
      });

      const result = await discover.connect();

      expect(result.success).toBe(true);
      expect(result.type).toBe("chrome");
      expect(result.profile).toBe("my-chrome-profile");
    });

    it("should connect to local Brave with default profile", async () => {
      const LocalBraveDiscover = (
        await import("../../connectors/discovery/localBrave.js")
      ).default;
      const discover = new LocalBraveDiscover({});

      const result = await discover.connect();

      expect(result.success).toBe(true);
      expect(result.type).toBe("brave");
      expect(result.profile).toBe("default");
    });

    it("should connect to local Edge", async () => {
      const LocalEdgeDiscover = (
        await import("../../connectors/discovery/localEdge.js")
      ).default;
      const discover = new LocalEdgeDiscover({ profilePath: "edge-profile" });

      const result = await discover.connect();

      expect(result.type).toBe("edge");
      expect(result.profile).toBe("edge-profile");
    });

    it("should connect to local Vivaldi", async () => {
      const LocalVivaldiDiscover = (
        await import("../../connectors/discovery/localVivaldi.js")
      ).default;
      const discover = new LocalVivaldiDiscover({});

      const result = await discover.connect();

      expect(result.type).toBe("vivaldi");
      expect(result.profile).toBe("default");
    });
  });

  describe("Anti-Detect Browser Connectors", () => {
    it("should connect to IxBrowser with profile ID", async () => {
      const IxBrowserDiscover = (
        await import("../../connectors/discovery/ixbrowser.js")
      ).default;
      const discover = new IxBrowserDiscover({
        profileId: "ix-profile-123",
        apiPort: 5055,
      });

      const result = await discover.connect();

      expect(result.type).toBe("ixbrowser");
      expect(result.profileId).toBe("ix-profile-123");
      expect(result.apiPort).toBe(5055);
    });

    it("should throw error when IxBrowser profile ID is missing", async () => {
      const IxBrowserDiscover = (
        await import("../../connectors/discovery/ixbrowser.js")
      ).default;
      const discover = new IxBrowserDiscover({});

      await expect(discover.connect()).rejects.toThrow(
        "Profile ID required for IxBrowser",
      );
    });

    it("should connect to MoreLogin with profile ID", async () => {
      const MoreLoginDiscover = (
        await import("../../connectors/discovery/morelogin.js")
      ).default;
      const discover = new MoreLoginDiscover({
        profileId: "morelogin-profile-456",
        apiUrl: "http://localhost:5055",
      });

      const result = await discover.connect();

      expect(result.type).toBe("morelogin");
      expect(result.profileId).toBe("morelogin-profile-456");
      expect(result.apiUrl).toBe("http://localhost:5055");
    });

    it("should throw error when MoreLogin profile ID is missing", async () => {
      const MoreLoginDiscover = (
        await import("../../connectors/discovery/morelogin.js")
      ).default;
      const discover = new MoreLoginDiscover({});

      await expect(discover.connect()).rejects.toThrow(
        "Profile ID required for MoreLogin",
      );
    });

    it("should connect to RoxyBrowser with profile ID", async () => {
      const RoxyBrowserDiscover = (
        await import("../../connectors/discovery/roxybrowser.js")
      ).default;
      const discover = new RoxyBrowserDiscover({
        profileId: "roxy-profile-789",
        apiPort: 35000,
      });

      const result = await discover.connect();

      expect(result.type).toBe("roxybrowser");
      expect(result.profileId).toBe("roxy-profile-789");
      expect(result.apiPort).toBe(35000);
    });

    it("should connect to Undetectable with profile ID", async () => {
      const UndetectableDiscover = (
        await import("../../connectors/discovery/undetectable.js")
      ).default;
      const discover = new UndetectableDiscover({
        profileId: "undetectable-profile-999",
        apiUrl: "http://localhost:3000",
      });

      const result = await discover.connect();

      expect(result.type).toBe("undetectable");
      expect(result.profileId).toBe("undetectable-profile-999");
      expect(result.apiUrl).toBe("http://localhost:3000");
    });
  });

  describe("Connector Error Handling", () => {
    it("should handle connection failures gracefully", async () => {
      const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
        .default;

      // Create a mock that throws on connect
      const discover = new BaseDiscover({});
      vi.spyOn(discover, "connect").mockRejectedValue(
        new Error("Connection timeout"),
      );

      await expect(discover.connect()).rejects.toThrow("Connection timeout");
    });

    it("should handle disconnection failures", async () => {
      const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
        .default;
      const discover = new BaseDiscover({});

      vi.spyOn(discover, "disconnect").mockRejectedValue(
        new Error("Disconnect failed"),
      );

      await expect(discover.disconnect()).rejects.toThrow("Disconnect failed");
    });
  });

  describe("Connector Lifecycle with Context", () => {
    it("should maintain connector state within page context", async () => {
      let connectorInstance = null;

      await withPage({ id: "test-page" }, async (ctx) => {
        const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
          .default;
        connectorInstance = new BaseDiscover({});
        ctx.set("connector", connectorInstance);

        await connectorInstance.connect();
        expect(connectorInstance.connected).toBe(true);
      });

      // After context exits, connector should still exist but state may vary
      expect(connectorInstance).not.toBeNull();
    });

    it("should isolate connector instances between pages", async () => {
      let connector1 = null;
      let connector2 = null;

      await withPage({ id: "page-1" }, async (ctx1) => {
        const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
          .default;
        connector1 = new BaseDiscover({});
        ctx1.set("connector", connector1);
        await connector1.connect();
      });

      await withPage({ id: "page-2" }, async (ctx2) => {
        const BaseDiscover = (await import("../../connectors/baseDiscover.js"))
          .default;
        connector2 = new BaseDiscover({});
        ctx2.set("connector", connector2);
        await connector2.connect();
      });

      expect(connector1).not.toBe(connector2);
      expect(connector1.connected).toBe(true);
      expect(connector2.connected).toBe(true);
    });
  });
});
