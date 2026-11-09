import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error: untyped Knockout-era module
import provider from "../../media/js/utils/map-popup-provider.js";

vi.mock("arches", () => ({ default: { urls: { root: "/en/" } } }));
vi.mock("knockout", () => ({ default: {} }));

const overlayFeature = { properties: {} };
const resourceFeature = { properties: { resourceinstanceid: "abc" } };

describe("map popup provider template fetch", () => {
    const open = vi.fn();
    let status: number;

    beforeEach(() => {
        status = 200;
        open.mockClear();
        vi.stubGlobal(
            "XMLHttpRequest",
            class {
                open = open;
                send = vi.fn();
                responseText = "<div></div>";
                get status() {
                    return status;
                }
            },
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("requests the overlay template from the site root", () => {
        expect(provider.getPopupTemplate([overlayFeature])).toBe("<div></div>");
        expect(open).toHaveBeenCalledWith(
            "GET",
            "/en/templates/views/components/external-overlay-popup.htm",
            false,
        );
    });

    it("requests the core template from the site root", () => {
        provider.getPopupTemplate([resourceFeature, overlayFeature]);
        expect(open).toHaveBeenCalledWith(
            "GET",
            "/en/templates/views/components/map-popup.htm",
            false,
        );
    });

    it("throws rather than returning an error page", () => {
        status = 404;
        expect(() => provider.getPopupTemplate([overlayFeature])).toThrow(
            "HTTP 404",
        );
    });
});
