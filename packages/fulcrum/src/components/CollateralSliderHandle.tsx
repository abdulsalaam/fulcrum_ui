import React, { Fragment } from "react";
import { Tooltip } from "react-tippy";
import { ReactComponent as OpenManageCollateral } from "../assets/images/openManageCollateral.svg";

export function CollateralSliderHandle({
  domain: [min, max],
  handle: { id, value, percent },
  getHandleProps
}: {
  domain: ReadonlyArray<number>;
  handle: { id: string; value: number; percent: number };
  getHandleProps: any;
}) {
  return (
    <Fragment>
      <div
        style={{
          left: `${percent}%`,
          position: "absolute",
          transform: "translate(-50%, -50%)",
          WebkitTapHighlightColor: "rgba(0,0,0,0)",
          zIndex: 5,
          width: "43px",
          height: "31px",
          cursor: "pointer",
          backgroundColor: "none"
        }}
        {...getHandleProps(id)}
      >
        <Tooltip title={`${value}%`} position="top" open={true} arrow={true} trigger="manual" arrowSize="small">
          <div style={{ lineHeight: "2.25rem" }}>&nbsp;</div>
        </Tooltip>
      </div>

      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{
          left: `${percent}%`,
          position: "absolute",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          width: "31px",
          height: "31px",
          border: "6px solid #444e5a",
          borderRadius: "50%",
          backgroundColor: "#276BFB"
        }}>
        <div
          style={{
            padding: "7px 9px",
            transform: "scale(1.1)"
          }}>
          <OpenManageCollateral /></div>
      </div>
    </Fragment>
  );
}
