import React from "react";
import { FooterMenu } from "./FooterMenu";
import { FooterSocial } from "./FooterSocial";

export const Footer = () => {
  return (
    <footer>
      <div className="container container-md">
        <div className="flex fw-w">
          <FooterSocial />
          <FooterMenu />
        </div>
      </div>
    </footer>
  );
}
