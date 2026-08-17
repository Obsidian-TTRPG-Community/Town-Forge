import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { BUILDING_IMAGES, BUILDING_KEY } from "./buildingkey";
import { TOWN_FORGE_VIEW, TownForgePreviewView } from "./panel";
import { DEFAULT_PIN_TYPES, newCustomPinType, parsePinTypesJson, pinTypesToJson } from "./pintypes";
import { MAP_SIZE_BY_SIZE } from "./buildings";
import { generateFull } from "./generate";
import { renderFull, renderScene } from "./render";
import { generateLandscape } from "./landscape";
import type { MapConfig, TownForgeSettings } from "./types";

export const VALID_TERRAINS = ["inland", "coastal", "river", "lake", "mountain"];
// Bundled place-note templates (the "portrait edition") — seeded into
// the template folder by the "Create place templates" settings button.
// Canonical copies live in the Randomness repo (community-generators/
// fantasy-hub/townforge-templates); refresh here at release time.
export const TF_ICON_LIBRARY = [{"key":"castle-flag","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20613%20613%22%20fill%3D%22%23c20000%22%3E%3Cpath%20d%3D%22M489.479%2C13.644v80.978h-56.544V13.644h-92.844v80.978h-55.847V13.644H191.4v80.978h-55.847V13.644H42.709l-0.006-0.003%0A%09v135.428l79.582%2C75.393v220.595c42.801%2C55.699%2C104.576%2C106.826%2C189.182%2C155.674c86.493-49.938%2C148.648-103.361%2C191.275-159.86%0A%09V224.465l79.582-75.393V13.644H489.479z%20M312.86%2C327.482H177.432V197.238l-55.847-52.358H312.86V327.482z%20M447.592%2C417.136%0A%09c-29.824%2C39.564-73.923%2C77.347-134.032%2C112.39V328.88h134.032L447.592%2C417.136L447.592%2C417.136z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"place-of-worship","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20640%20512%22%20fill%3D%22%23b30000%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M344%2024c0-13.3-10.7-24-24-24s-24%2010.7-24%2024V48H264c-13.3%200-24%2010.7-24%2024s10.7%2024%2024%2024h32v46.4L183.3%20210c-14.5%208.7-23.3%2024.3-23.3%2041.2V512h96V416c0-35.3%2028.7-64%2064-64s64%2028.7%2064%2064v96h96V251.2c0-16.9-8.8-32.5-23.3-41.2L344%20142.4V96h32c13.3%200%2024-10.7%2024-24s-10.7-24-24-24H344V24zM24.9%20330.3C9.5%20338.8%200%20354.9%200%20372.4V464c0%2026.5%2021.5%2048%2048%2048h80V273.6L24.9%20330.3zM592%20512c26.5%200%2048-21.5%2048-48V372.4c0-17.5-9.5-33.6-24.9-42.1L512%20273.6V512h80z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"scale-balanced","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20640%20512%22%20fill%3D%22%23a30000%22%3E%3Cpath%20d%3D%22M384%2032H512c17.7%200%2032%2014.3%2032%2032s-14.3%2032-32%2032H398.4c-5.2%2025.8-22.9%2047.1-46.4%2057.3V448H512c17.7%200%2032%2014.3%2032%2032s-14.3%2032-32%2032H320%20128c-17.7%200-32-14.3-32-32s14.3-32%2032-32H288V153.3c-23.5-10.3-41.2-31.6-46.4-57.3H128c-17.7%200-32-14.3-32-32s14.3-32%2032-32H256c14.6-19.4%2037.8-32%2064-32s49.4%2012.6%2064%2032zm55.6%20288H584.4L512%20195.8%20439.6%20320zM512%20416c-62.9%200-115.2-34-126-78.9c-2.6-11%201-22.3%206.7-32.1l95.2-163.2c5-8.6%2014.2-13.8%2024.1-13.8s19.1%205.3%2024.1%2013.8l95.2%20163.2c5.7%209.8%209.3%2021.1%206.7%2032.1C627.2%20382%20574.9%20416%20512%20416zM126.8%20195.8L54.4%20320H199.3L126.8%20195.8zM.9%20337.1c-2.6-11%201-22.3%206.7-32.1l95.2-163.2c5-8.6%2014.2-13.8%2024.1-13.8s19.1%205.3%2024.1%2013.8l95.2%20163.2c5.7%209.8%209.3%2021.1%206.7%2032.1C242%20382%20189.7%20416%20126.8%20416S11.7%20382%20.9%20337.1z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"shield","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%20fill%3D%22%23b30000%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M256%200c4.6%200%209.2%201%2013.4%202.9L457.7%2082.8c22%209.3%2038.4%2031%2038.3%2057.2c-.5%2099.2-41.3%20280.7-213.6%20363.2c-16.7%208-36.1%208-52.8%200C57.3%20420.7%2016.5%20239.2%2016%20140c-.1-26.2%2016.3-47.9%2038.3-57.2L242.7%202.9C246.8%201%20251.4%200%20256%200zm0%2066.8V444.8C394%20378%20431.1%20230.1%20432%20141.4L256%2066.8l0%200z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"anchor","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20576%20512%22%20fill%3D%22%23010057%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M320%2096a32%2032%200%201%201%20-64%200%2032%2032%200%201%201%2064%200zm21.1%2080C367%20158.8%20384%20129.4%20384%2096c0-53-43-96-96-96s-96%2043-96%2096c0%2033.4%2017%2062.8%2042.9%2080H224c-17.7%200-32%2014.3-32%2032s14.3%2032%2032%2032h32V448H208c-53%200-96-43-96-96v-6.1l7%207c9.4%209.4%2024.6%209.4%2033.9%200s9.4-24.6%200-33.9L97%20263c-9.4-9.4-24.6-9.4-33.9%200L7%20319c-9.4%209.4-9.4%2024.6%200%2033.9s24.6%209.4%2033.9%200l7-7V352c0%2088.4%2071.6%20160%20160%20160h80%2080c88.4%200%20160-71.6%20160-160v-6.1l7%207c9.4%209.4%2024.6%209.4%2033.9%200s9.4-24.6%200-33.9l-56-56c-9.4-9.4-24.6-9.4-33.9%200l-56%2056c-9.4%209.4-9.4%2024.6%200%2033.9s24.6%209.4%2033.9%200l7-7V352c0%2053-43%2096-96%2096H320V240h32c17.7%200%2032-14.3%2032-32s-14.3-32-32-32H341.1z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"building-wheat","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20640%20512%22%20fill%3D%22%23cc3300%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M0%2048C0%2021.5%2021.5%200%2048%200H336c26.5%200%2048%2021.5%2048%2048V464c0%2026.5-21.5%2048-48%2048H240V432c0-26.5-21.5-48-48-48s-48%2021.5-48%2048v80H48c-26.5%200-48-21.5-48-48V48zM80%20224c-8.8%200-16%207.2-16%2016v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V240c0-8.8-7.2-16-16-16H80zm80%2016v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V240c0-8.8-7.2-16-16-16H176c-8.8%200-16%207.2-16%2016zm112-16c-8.8%200-16%207.2-16%2016v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V240c0-8.8-7.2-16-16-16H272zM64%20112v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V112c0-8.8-7.2-16-16-16H80c-8.8%200-16%207.2-16%2016zM176%2096c-8.8%200-16%207.2-16%2016v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V112c0-8.8-7.2-16-16-16H176zm80%2016v32c0%208.8%207.2%2016%2016%2016h32c8.8%200%2016-7.2%2016-16V112c0-8.8-7.2-16-16-16H272c-8.8%200-16%207.2-16%2016zm384%2080v16c0%2044.2-35.8%2080-80%2080H544V272c0-44.2%2035.8-80%2080-80h16zm0%20128c0%2044.2-35.8%2080-80%2080H544V384c0-44.2%2035.8-80%2080-80h16v16zm0%20112c0%2044.2-35.8%2080-80%2080H544V496c0-44.2%2035.8-80%2080-80h16v16zM512%20496v16H496c-44.2%200-80-35.8-80-80V416h16c44.2%200%2080%2035.8%2080%2080zm0-96H496c-44.2%200-80-35.8-80-80V304h16c44.2%200%2080%2035.8%2080%2080v16zm0-128v16H496c-44.2%200-80-35.8-80-80V192h16c44.2%200%2080%2035.8%2080%2080zM528%2032c13.3%200%2024%2010.7%2024%2024V160c0%2013.3-10.7%2024-24%2024s-24-10.7-24-24V56c0-13.3%2010.7-24%2024-24zm96%2064v32c0%2013.3-10.7%2024-24%2024s-24-10.7-24-24V96c0-13.3%2010.7-24%2024-24s24%2010.7%2024%2024zM456%2072c13.3%200%2024%2010.7%2024%2024v32c0%2013.3-10.7%2024-24%2024s-24-10.7-24-24V96c0-13.3%2010.7-24%2024-24z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"horseshoe","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20576%20512%22%20fill%3D%22%23c70000%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M448%20238.1V160h16l9.8%2019.6c12.5%2025.1%2042.2%2036.4%2068.3%2026c20.5-8.2%2033.9-28%2033.9-50.1V80c0-19.1-8.4-36.3-21.7-48H560c8.8%200%2016-7.2%2016-16s-7.2-16-16-16H480%20448C377.3%200%20320%2057.3%20320%20128H224%20203.2%20148.8c-30.7%200-57.6%2016.3-72.5%2040.8C33.2%20174.5%200%20211.4%200%20256v56c0%2013.3%2010.7%2024%2024%2024s24-10.7%2024-24V256c0-13.4%206.6-25.2%2016.7-32.5c1.6%2013%206.3%2025.4%2013.6%2036.4l28.2%2042.4c8.3%2012.4%206.4%2028.7-1.2%2041.6c-16.5%2028-20.6%2062.2-10%2093.9l17.5%2052.4c4.4%2013.1%2016.6%2021.9%2030.4%2021.9h33.7c21.8%200%2037.3-21.4%2030.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4%204.3-18.2l12.7-12.7c13.2-13.2%2020.6-31.1%2020.6-49.7c0-2.3-.1-4.6-.3-6.9l84%2024c4.1%201.2%208.2%202.1%2012.3%202.8V480c0%2017.7%2014.3%2032%2032%2032h32c17.7%200%2032-14.3%2032-32V315.7c19.2-19.2%2031.5-45.7%2032-75.7h0v-1.9zM496%2064a16%2016%200%201%201%200%2032%2016%2016%200%201%201%200-32z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"wheat-awn","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%20fill%3D%22%23bd0000%22%3E%3Cpath%20d%3D%22M505%2041c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200L383%2095c-9.4%209.4-9.4%2024.6%200%2033.9s24.6%209.4%2033.9%200l88-88zM305.5%2027.3c-6.2-6.2-16.4-6.2-22.6%200L271.5%2038.6c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4-30.5%2030.5c-3.4-27.3-15.5-53.8-36.5-74.8l-11.3-11.3c-6.2-6.2-16.4-6.2-22.6%200l-11.3%2011.3c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4-30.5%2030.5c-3.4-27.3-15.5-53.8-36.5-74.8L101.8%20231c-6.2-6.2-16.4-6.2-22.6%200L67.9%20242.3c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4L9.4%20457.4c-12.5%2012.5-12.5%2032.8%200%2045.3s32.8%2012.5%2045.3%200l68.9-68.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200l11.3-11.3c6.2-6.2%206.2-16.4%200-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200l11.3-11.3c6.2-6.2%206.2-16.4%200-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200L486.5%20231c6.2-6.2%206.2-16.4%200-22.6L475.2%20197c-5.2-5.2-10.6-9.8-16.4-13.9L505%20137c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200l-59.4%2059.4c-20.6-4.4-42-3.7-62.3%202.1c6.1-21.3%206.6-43.8%201.4-65.3L409%2041c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200L329.1%2052.9c-3.7-5-7.8-9.8-12.4-14.3L305.5%2027.3z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"shop","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20576%20512%22%20fill%3D%22%232d2a2a%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M0%2024C0%2010.7%2010.7%200%2024%200H69.5c22%200%2041.5%2012.8%2050.6%2032h411c26.3%200%2045.5%2025%2038.6%2050.4l-41%20152.3c-8.5%2031.4-37%2053.3-69.5%2053.3H170.7l5.4%2028.5c2.2%2011.3%2012.1%2019.5%2023.6%2019.5H488c13.3%200%2024%2010.7%2024%2024s-10.7%2024-24%2024H199.7c-34.6%200-64.3-24.6-70.7-58.5L77.4%2054.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7%2048%200%2037.3%200%2024zM128%20464a48%2048%200%201%201%2096%200%2048%2048%200%201%201%20-96%200zm336-48a48%2048%200%201%201%200%2096%2048%2048%200%201%201%200-96z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"bed","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20version%3D%221.1%22%20id%3D%22Layer_1%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%22613px%22%20height%3D%22613px%22%20viewBox%3D%220%200%20613%20613%22%20enable-background%3D%22new%200%200%20613%20613%22%20xml%3Aspace%3D%22preserve%22%20fill%3D%22%23a8002a%22%3E%0A%3Cpath%20d%3D%22M153.535%2C507.493l-30.852%2C64.497h462.243l-35.994-64.497h-22.196c-20.753-115.089-36.26-252.254-25.888-334.041%20%20c27.165-2.534%2C46.906-26.333%2C45.299-61.198c-2.486-53.168-61.889-73.677-109.205-41.733c-20.196-27.505-57.877-34.71-79.494-11.236%20%20c-33.468-42.191-100.45-34.136-118.84%2C15.249c-38.668-8.564-67.764%2C9.796-68.254%2C45.748c-0.486%2C35.739%2C21.762%2C48.405%2C48.117%2C45.8%20%20c0.738%2C6.217%2C1.34%2C12.919%2C1.806%2C20.053c-48.382-1.062-95.694-9.65-142.317-23.09C45.187%2C263.067%2C30.824%2C365.168%2C34.443%2C469.3%20%20c50.855%2C22.155%2C104.923%2C21.697%2C158.957%2C21.484c-1.187%2C5.647-2.405%2C11.225-3.659%2C16.709H153.535z%20M77.152%2C439.02%20%20c-2.785-79.941%2C8.264-145.395%2C33.466-223.58l0.002%2C0.001c36.314%2C8.643%2C73.172%2C10.801%2C110.877%2C8.325%20%20c0.334%2C64.498-6.956%2C148.768-20.186%2C225.53C159.12%2C451.571%2C116.864%2C454.324%2C77.152%2C439.02z%22%2F%3E%0A%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"user-secret","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20448%20512%22%20fill%3D%22%230ba3b7%22%3E%3Cpath%20d%3D%22M224%2016c-6.7%200-10.8-2.8-15.5-6.1C201.9%205.4%20194%200%20176%200c-30.5%200-52%2043.7-66%2089.4C62.7%2098.1%2032%20112.2%2032%20128c0%2014.3%2025%2027.1%2064.6%2035.9c-.4%204-.6%208-.6%2012.1c0%2017%203.3%2033.2%209.3%2048H45.4C38%20224%2032%20230%2032%20237.4c0%201.7%20.3%203.4%201%205l38.8%2096.9C28.2%20371.8%200%20423.8%200%20482.3C0%20498.7%2013.3%20512%2029.7%20512H418.3c16.4%200%2029.7-13.3%2029.7-29.7c0-58.5-28.2-110.4-71.7-143L415%20242.4c.6-1.6%201-3.3%201-5c0-7.4-6-13.4-13.4-13.4H342.7c6-14.8%209.3-31%209.3-48c0-4.1-.2-8.1-.6-12.1C391%20155.1%20416%20142.3%20416%20128c0-15.8-30.7-29.9-78-38.6C324%2043.7%20302.5%200%20272%200c-18%200-25.9%205.4-32.5%209.9c-4.8%203.3-8.8%206.1-15.5%206.1zm56%20208H267.6c-16.5%200-31.1-10.6-36.3-26.2c-2.3-7-12.2-7-14.5%200c-5.2%2015.6-19.9%2026.2-36.3%2026.2H168c-22.1%200-40-17.9-40-40V169.6c28.2%204.1%2061%206.4%2096%206.4s67.8-2.3%2096-6.4V184c0%2022.1-17.9%2040-40%2040zm-88%2096l16%2032L176%20480%20128%20288l64%2032zm128-32L272%20480%20240%20352l16-32%2064-32z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"beer","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20version%3D%221.1%22%20id%3D%22Layer_1%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%22613px%22%20height%3D%22613px%22%20viewBox%3D%220%200%20613%20613%22%20enable-background%3D%22new%200%200%20613%20613%22%20xml%3Aspace%3D%22preserve%22%20fill%3D%22%2300b81f%22%3E%0A%3Cpath%20d%3D%22M153.535%2C507.493l-30.852%2C64.497h462.243l-35.994-64.497h-22.196c-20.753-115.089-36.26-252.254-25.888-334.041%20%20c27.165-2.534%2C46.906-26.333%2C45.299-61.198c-2.486-53.168-61.889-73.677-109.205-41.733c-20.196-27.505-57.877-34.71-79.494-11.236%20%20c-33.468-42.191-100.45-34.136-118.84%2C15.249c-38.668-8.564-67.764%2C9.796-68.254%2C45.748c-0.486%2C35.739%2C21.762%2C48.405%2C48.117%2C45.8%20%20c0.738%2C6.217%2C1.34%2C12.919%2C1.806%2C20.053c-48.382-1.062-95.694-9.65-142.317-23.09C45.187%2C263.067%2C30.824%2C365.168%2C34.443%2C469.3%20%20c50.855%2C22.155%2C104.923%2C21.697%2C158.957%2C21.484c-1.187%2C5.647-2.405%2C11.225-3.659%2C16.709H153.535z%20M77.152%2C439.02%20%20c-2.785-79.941%2C8.264-145.395%2C33.466-223.58l0.002%2C0.001c36.314%2C8.643%2C73.172%2C10.801%2C110.877%2C8.325%20%20c0.334%2C64.498-6.956%2C148.768-20.186%2C225.53C159.12%2C451.571%2C116.864%2C454.324%2C77.152%2C439.02z%22%2F%3E%0A%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"cross","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20384%20512%22%20fill%3D%22%2333322e%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M176%200c-26.5%200-48%2021.5-48%2048v80H48c-26.5%200-48%2021.5-48%2048v32c0%2026.5%2021.5%2048%2048%2048h80V464c0%2026.5%2021.5%2048%2048%2048h32c26.5%200%2048-21.5%2048-48V256h80c26.5%200%2048-21.5%2048-48V176c0-26.5-21.5-48-48-48H256V48c0-26.5-21.5-48-48-48H176z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"house-chimney-user","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20576%20512%22%20fill%3D%22%230a9900%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M543.8%20287.6c17%200%2032-14%2032-32.1c1-9-3-17-11-24L512%20185V64c0-17.7-14.3-32-32-32H448c-17.7%200-32%2014.3-32%2032v36.7L309.5%207c-6-5-14-7-21-7s-15%201-22%208L10%20231.5c-7%207-10%2015-10%2024c0%2018%2014%2032.1%2032%2032.1h32V448c0%2035.3%2028.7%2064%2064%2064H448.5c35.5%200%2064.2-28.8%2064-64.3l-.7-160.2h32zM288%20160a64%2064%200%201%201%200%20128%2064%2064%200%201%201%200-128zM176%20400c0-44.2%2035.8-80%2080-80h64c44.2%200%2080%2035.8%2080%2080c0%208.8-7.2%2016-16%2016H192c-8.8%200-16-7.2-16-16z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"hat-wizard","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%20fill%3D%22%233642ec%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.0%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20(Icons%3A%20CC%20BY%204.0%2C%20Fonts%3A%20SIL%20OFL%201.1%2C%20Code%3A%20MIT%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20d%3D%22M64%20416L168.6%20180.7c15.3-34.4%2040.3-63.5%2072-83.7l146.9-94c3-1.9%206.5-2.9%2010-2.9C407.7%200%20416%208.3%20416%2018.6v1.6c0%202.6-.5%205.1-1.4%207.5L354.8%20176.9c-1.9%204.7-2.8%209.7-2.8%2014.7c0%205.5%201.2%2011%203.4%2016.1L448%20416H240.9l11.8-35.4%2040.4-13.5c6.5-2.2%2010.9-8.3%2010.9-15.2s-4.4-13-10.9-15.2l-40.4-13.5-13.5-40.4C237%20276.4%20230.9%20272%20224%20272s-13%204.4-15.2%2010.9l-13.5%2040.4-40.4%2013.5C148.4%20339%20144%20345.1%20144%20352s4.4%2013%2010.9%2015.2l40.4%2013.5L207.1%20416H64zM279.6%20141.5c-1.1-3.3-4.1-5.5-7.6-5.5s-6.5%202.2-7.6%205.5l-6.7%2020.2-20.2%206.7c-3.3%201.1-5.5%204.1-5.5%207.6s2.2%206.5%205.5%207.6l20.2%206.7%206.7%2020.2c1.1%203.3%204.1%205.5%207.6%205.5s6.5-2.2%207.6-5.5l6.7-20.2%2020.2-6.7c3.3-1.1%205.5-4.1%205.5-7.6s-2.2-6.5-5.5-7.6l-20.2-6.7-6.7-20.2zM32%20448H480c17.7%200%2032%2014.3%2032%2032s-14.3%2032-32%2032H32c-17.7%200-32-14.3-32-32s14.3-32%2032-32z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"castle","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20613%20613%22%20fill%3D%22%23c20000%22%3E%3Cpath%20d%3D%22M489.479%2C13.644v80.978h-56.544V13.644h-92.844v80.978h-55.847V13.644H191.4v80.978h-55.847V13.644H42.709l-0.006-0.003%0A%09v135.428l79.582%2C75.393v220.595c42.801%2C55.699%2C104.576%2C106.826%2C189.182%2C155.674c86.493-49.938%2C148.648-103.361%2C191.275-159.86%0A%09V224.465l79.582-75.393V13.644H489.479z%20M312.86%2C327.482H177.432V197.238l-55.847-52.358H312.86V327.482z%20M447.592%2C417.136%0A%09c-29.824%2C39.564-73.923%2C77.347-134.032%2C112.39V328.88h134.032L447.592%2C417.136L447.592%2C417.136z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"circle_black_city","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20640%20512%22%20fill%3D%22%23a30000%22%3E%3Cpath%20d%3D%22M384%2032H512c17.7%200%2032%2014.3%2032%2032s-14.3%2032-32%2032H398.4c-5.2%2025.8-22.9%2047.1-46.4%2057.3V448H512c17.7%200%2032%2014.3%2032%2032s-14.3%2032-32%2032H320%20128c-17.7%200-32-14.3-32-32s14.3-32%2032-32H288V153.3c-23.5-10.3-41.2-31.6-46.4-57.3H128c-17.7%200-32-14.3-32-32s14.3-32%2032-32H256c14.6-19.4%2037.8-32%2064-32s49.4%2012.6%2064%2032zm55.6%20288H584.4L512%20195.8%20439.6%20320zM512%20416c-62.9%200-115.2-34-126-78.9c-2.6-11%201-22.3%206.7-32.1l95.2-163.2c5-8.6%2014.2-13.8%2024.1-13.8s19.1%205.3%2024.1%2013.8l95.2%20163.2c5.7%209.8%209.3%2021.1%206.7%2032.1C627.2%20382%20574.9%20416%20512%20416zM126.8%20195.8L54.4%20320H199.3L126.8%20195.8zM.9%20337.1c-2.6-11%201-22.3%206.7-32.1l95.2-163.2c5-8.6%2014.2-13.8%2024.1-13.8s19.1%205.3%2024.1%2013.8l95.2%20163.2c5.7%209.8%209.3%2021.1%206.7%2032.1C242%20382%20189.7%20416%20126.8%20416S11.7%20382%20.9%20337.1z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"wheat","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%20fill%3D%22%23bd0000%22%3E%3Cpath%20d%3D%22M505%2041c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200L383%2095c-9.4%209.4-9.4%2024.6%200%2033.9s24.6%209.4%2033.9%200l88-88zM305.5%2027.3c-6.2-6.2-16.4-6.2-22.6%200L271.5%2038.6c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4-30.5%2030.5c-3.4-27.3-15.5-53.8-36.5-74.8l-11.3-11.3c-6.2-6.2-16.4-6.2-22.6%200l-11.3%2011.3c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4-30.5%2030.5c-3.4-27.3-15.5-53.8-36.5-74.8L101.8%20231c-6.2-6.2-16.4-6.2-22.6%200L67.9%20242.3c-37.5%2037.5-37.5%2098.3%200%20135.8l10.4%2010.4L9.4%20457.4c-12.5%2012.5-12.5%2032.8%200%2045.3s32.8%2012.5%2045.3%200l68.9-68.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200l11.3-11.3c6.2-6.2%206.2-16.4%200-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200l11.3-11.3c6.2-6.2%206.2-16.4%200-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9%2012.2%2012.2c37.5%2037.5%2098.3%2037.5%20135.8%200L486.5%20231c6.2-6.2%206.2-16.4%200-22.6L475.2%20197c-5.2-5.2-10.6-9.8-16.4-13.9L505%20137c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200l-59.4%2059.4c-20.6-4.4-42-3.7-62.3%202.1c6.1-21.3%206.6-43.8%201.4-65.3L409%2041c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200L329.1%2052.9c-3.7-5-7.8-9.8-12.4-14.3L305.5%2027.3z%22%2F%3E%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true},{"key":"beer-stein","pathOrDataUrl":"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20version%3D%221.1%22%20id%3D%22Layer_1%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%22613px%22%20height%3D%22613px%22%20viewBox%3D%220%200%20613%20613%22%20enable-background%3D%22new%200%200%20613%20613%22%20xml%3Aspace%3D%22preserve%22%20fill%3D%22%2300b81f%22%3E%0A%3Cpath%20d%3D%22M153.535%2C507.493l-30.852%2C64.497h462.243l-35.994-64.497h-22.196c-20.753-115.089-36.26-252.254-25.888-334.041%20%20c27.165-2.534%2C46.906-26.333%2C45.299-61.198c-2.486-53.168-61.889-73.677-109.205-41.733c-20.196-27.505-57.877-34.71-79.494-11.236%20%20c-33.468-42.191-100.45-34.136-118.84%2C15.249c-38.668-8.564-67.764%2C9.796-68.254%2C45.748c-0.486%2C35.739%2C21.762%2C48.405%2C48.117%2C45.8%20%20c0.738%2C6.217%2C1.34%2C12.919%2C1.806%2C20.053c-48.382-1.062-95.694-9.65-142.317-23.09C45.187%2C263.067%2C30.824%2C365.168%2C34.443%2C469.3%20%20c50.855%2C22.155%2C104.923%2C21.697%2C158.957%2C21.484c-1.187%2C5.647-2.405%2C11.225-3.659%2C16.709H153.535z%20M77.152%2C439.02%20%20c-2.785-79.941%2C8.264-145.395%2C33.466-223.58l0.002%2C0.001c36.314%2C8.643%2C73.172%2C10.801%2C110.877%2C8.325%20%20c0.334%2C64.498-6.956%2C148.768-20.186%2C225.53C159.12%2C451.571%2C116.864%2C454.324%2C77.152%2C439.02z%22%2F%3E%0A%3C%2Fsvg%3E","size":24,"anchorX":12,"anchorY":12,"defaultLink":"","inCollections":true}];
export const TOWN_FORGE_TEMPLATES = {
  "Barracks.md": "---\ntype: barracks\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} guarding {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The commander \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Commander\", \"Commands\"); }\n\nconst result = await api.rollUnscoped(\"TF-Barracks\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\", size: \"{{size}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// A couple of faces from the roster.\nif (has) {\n  tR += \"\\n\\n## On the roster\\n\\n\";\n  tR += await face(await rollUnique(), \"Sergeant\");\n  tR += await face(await rollUnique(), \"Guard\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Castle.md": "---\ntype: castle\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\nheraldry-seed: <% Date.now().toString(36) + Math.random().toString(36).slice(2, 6) %>\n---\n\n# {{name}}\n> [!infobox]+\n> # {{name}}\n> `heraldry:|120`\n> ###### Stats\n> | Type | Stat |\n> | --- | --- |\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} overlooking {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRowName, lastRowVal) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRowName} | ${lastRowVal} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The ruler \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Ruler\", \"Holds\", \"{{name}}\"); }\n\nconst result = await api.rollUnscoped(\"TF-Castle\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// The household.\nif (has) {\n  tR += \"\\n\\n## At court\\n\\n\";\n  tR += await face(await rollUnique(), \"Captain of the guard\");\n  tR += await face(await rollUnique(), \"Steward\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n\n```heraldry\n```\n",
  "Dock.md": "---\ntype: dock\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the river near {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The harbormaster \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Harbormaster\", \"Runs\"); }\n\nconst result = await api.rollUnscoped(\"TF-Dock\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// A face on the waterfront.\nif (has) {\n  tR += \"\\n\\n## On the waterfront\\n\\n\";\n  tR += await face(await rollUnique(), \"Dockhand\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Farm.md": "---\ntype: farm\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the outskirts of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The farmer \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Farmer\", \"Works\"); }\n\nconst result = await api.rollUnscoped(\"TF-Farm\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Help around the place.\nif (has) {\n  tR += \"\\n\\n## Around the yard\\n\\n\";\n  tR += await face(await rollUnique(), \"Farmhand\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Inn.md": "---\ntype: inn\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The host \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Innkeeper\", \"Keeps\"); }\n\nconst result = await api.rollUnscoped(\"TF-Inn\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Someone staying the night.\nif (has) {\n  tR += \"\\n\\n## In the common room\\n\\n\";\n  tR += await face(await rollUnique(), \"A guest\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Manor.md": "---\ntype: manor\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The head of the house \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Head of the house\", \"Holds\"); }\n\nconst result = await api.rollUnscoped(\"TF-Manor\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// The household.\nif (has) {\n  tR += \"\\n\\n## In service\\n\\n\";\n  tR += await face(await rollUnique(), \"Servant\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Market.md": "---\ntype: market\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} in the heart of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// This generator scales with settlement size: pass {{size}} so the\n// count and the mix of goods match the town tier. The market has no\n// single proprietor \u2014 the faces below are the crowd instead.\nconst result = await api.rollUnscoped(\"TF-Market\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\", size: \"{{size}}\"\n}});\ntR += result.result;\n\nif (has) {\n  tR += \"\\n\\n## Faces in the crowd\\n\\n\";\n  tR += await face(await rollUnique(), \"Stallholder\");\n  tR += await face(await rollUnique(), \"Shopper\");\n  tR += await face(await rollUnique({ age: \"young\" }), \"Errand-runner\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Mill.md": "---\ntype: mill\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the outskirts of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\n\n// The miller \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Miller\", \"Runs\"); }\n\nconst result = await api.rollUnscoped(\"TF-Mill\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Shop.md": "---\ntype: shop\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{subtype}} {{type}} in {{town}}\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\n\n// \u2500\u2500\u2500 ONE keeper + ONE customer across the whole note \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// Both rolled once; the generator's Proprietor line, quotes, and\n// \"Also here\" customer all describe these exact people. With no pack\n// installed both stay null and the generator rolls its own (as before).\nlet keeper = null, shopper = null;\nif (has) {\n  keeper = await rollUnique();\n  shopper = await rollUnique();\n  // Constrain if you like, e.g.:\n  //   P.roll({ gender: \"female\", race: \"gnome\", age: \"old\" })\n  tR += infobox(keeper, \"Shopkeeper\", \"Runs\");\n}\n\nconst shop = await api.rollUnscoped(\"TF-ShopByType\", {\n  promptValues: {\n    town: \"{{town}}\",\n    shopType: \"{{subtype}}\",\n    shopName: \"{{name}}\",\n    size: \"{{size}}\",\n    keeperName: keeper?.name ?? \"\",\n    keeperRace: keeper ? raceWord(keeper) : \"\",\n    keeperGender: keeper?.gender ?? \"\",\n    keeperAge: keeper?.age ?? \"\",\n    keeperDesc: keeper ? descOf(keeper) : \"\",\n    custName: shopper?.name ?? \"\",\n    custRace: shopper ? raceWord(shopper) : \"\",\n    custDesc: shopper ? descOf(shopper) : \"\"\n  }\n});\ntR += shop.result;\n\n// The customer from the \"Also here\" line, with a face.\nif (has && shopper) {\n  tR += \"\\n\\n## Seen browsing\\n\\n\";\n  tR += `- ${P.inlineSnippet(shopper.recipe, 96)} **${shopper.name}**\\n`;\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Stable.md": "---\ntype: stable\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the outskirts of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The stablemaster \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Stablemaster\", \"Runs\"); }\n\nconst result = await api.rollUnscoped(\"TF-Stable\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Help in the yard.\nif (has) {\n  tR += \"\\n\\n## In the yard\\n\\n\";\n  tR += await face(await rollUnique({ age: \"young\" }), \"Stablehand\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Tavern.md": "---\ntype: tavern\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The keep \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Keep\", \"Pours at\"); }\n\nconst result = await api.rollUnscoped(\"TF-Tavern\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Propping up the bar.\nif (has) {\n  tR += \"\\n\\n## At the bar\\n\\n\";\n  tR += await face(await rollUnique(), \"Regular\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Temple.md": "---\ntype: temple\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The priest \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Priest\", \"Tends\"); }\n\nconst result = await api.rollUnscoped(\"TF-Temple\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Serving at the altar.\nif (has) {\n  tR += \"\\n\\n## In the sanctum\\n\\n\";\n  tR += await face(await rollUnique({ age: \"young\" }), \"Acolyte\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Thief Guild.md": "---\ntype: guild\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\nheraldry-seed: <% Date.now().toString(36) + Math.random().toString(36).slice(2, 6) %>\n---\n\n# {{name}}\n> [!infobox]+\n> # {{name}}\n> `heraldry:|120`\n> ###### Stats\n> | Type | Stat |\n> | --- | --- |\n\n> [!info] thieves' guild in {{town}}\n\nA criminal syndicate operating in the shadows of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The boss \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Boss\", \"Runs\"); }\n\nconst result = await api.rollUnscoped(\"TF-Guild\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  slant: \"criminal\", size: \"{{size}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Watching the door.\nif (has) {\n  tR += \"\\n\\n## In the shadows\\n\\n\";\n  tR += await face(await rollUnique({ age: \"young\" }), \"Lookout\");\n  tR += await face(await rollUnique(), \"Fence\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n\n```heraldry\n```\n",
  "Tower.md": "---\ntype: tower\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\nconst face = async (p, role) => {\n  const beat = (await api.rollUnscoped(\"Personality\")).result;\n  return `- ${P.inlineSnippet(p.recipe, 96)} **${p.name}** \u2014 ${role}, ${beat}\\n`;\n};\n\n// The resident mage \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Resident mage\", \"Keeps\"); }\n\nconst result = await api.rollUnscoped(\"TF-Tower\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Sweeping the stairs, fetching components.\nif (has) {\n  tR += \"\\n\\n## Up the stairs\\n\\n\";\n  tR += await face(await rollUnique({ age: \"young\" }), \"Apprentice\");\n}\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
  "Undertaker.md": "---\ntype: undertaker\nsubtype: \"{{subtype}}\"\nsize: \"{{size}}\"\ntown: \"{{town}}\"\n---\n# {{name}}\n\n> [!info] {{type}} in {{town}}\n\nA {{type}} on the streets of {{town}}.\n\n<%*\nconst api = app.plugins.plugins[\"randomness\"].api;\nconst P = api.portraits;\nconst has = P && (await P.available());\n// Names come from the Fantasy Hub pool (TF-PersonName, keyed by race_gender) rather than the portrait's own small built-in list, and are checked against a 'cast' list kept in the map folder's town note so no two places in a town hand out the same person. Falls back to the portrait's name, and to plain rolls, when either piece is missing.\nconst _tfNL = String.fromCharCode(10);\nconst _tfTownNote = (() => {\n  try {\n    const here = tp.file.folder(true);\n    const cut = here.lastIndexOf('/');\n    const parent = cut > 0 ? here.slice(0, cut) : here;\n    const base = parent.slice(parent.lastIndexOf('/') + 1);\n    return app.vault.getAbstractFileByPath(parent + '/' + base + '.md');\n  } catch (e) { return null; }\n})();\nconst _tfUsed = new Set();\nconst _tfFresh = new Set();\nif (_tfTownNote) {\n  try {\n    const rows = (await app.vault.read(_tfTownNote)).split(_tfNL);\n    let inFm = false, inCast = false;\n    for (let i = 0; i < rows.length; i++) {\n      const line = rows[i].trim();\n      if (i === 0) { inFm = line === '---'; continue; }\n      if (!inFm || line === '---') break;\n      if (line === 'cast:') { inCast = true; continue; }\n      if (inCast && line.slice(0, 2) === '- ') {\n        let v = line.slice(2).trim();\n        const q = v.charAt(0);\n        if ((q === String.fromCharCode(39) || q === String.fromCharCode(34)) && v.charAt(v.length - 1) === q) v = v.slice(1, -1);\n        if (v) _tfUsed.add(v);\n        continue;\n      }\n      if (inCast) inCast = false;\n    }\n  } catch (e) { }\n}\nconst _tfNameOf = async (p) => {\n  try {\n    const race = String(p.race || 'human').toLowerCase();\n    const gender = p.gender === 'female' ? 'female' : 'male';\n    const out = await api.rollUnscoped('TF-PersonName', { dictKey: race + '_' + gender });\n    const s = out && out.result ? String(out.result).trim() : '';\n    if (s) return s;\n  } catch (e) { }\n  return p.name;\n};\nconst rollUnique = async (opts) => {\n  let p = await P.roll(opts || {});\n  let name = await _tfNameOf(p);\n  for (let i = 0; i < 12 && _tfUsed.has(name); i++) {\n    if (i % 4 === 3) p = await P.roll(opts || {});\n    name = await _tfNameOf(p);\n  }\n  _tfUsed.add(name);\n  _tfFresh.add(name);\n  p.name = name;\n  return p;\n};\nconst raceWord = (p) => ({ halfelf: \"half-elf\", halforc: \"half-orc\" }[p.race] ?? p.race ?? \"\");\nconst descOf = (p) => p.age === \"old\" ? \"silver-haired\"\n  : (p.recipe.parts.scars ?? -1) >= 0 ? \"scarred\"\n  : (p.recipe.parts.facial_hair ?? -1) >= 0 ? \"bearded\"\n  : p.age === \"young\" ? \"fresh-faced\" : \"\";\nconst infobox = (p, heading, lastRow) => [\n  \"> [!infobox]\", `> # ${p.name}`,\n  \"> \" + P.inlineSnippet(p.recipe, 160),\n  `> ###### ${heading}`, \"> | |  |\", \"> | --- | --- |\",\n  `> | Race | ${raceWord(p)} |`, `> | Gender | ${p.gender} |`,\n  `> | Age | ${p.age} |`, `> | ${lastRow} | {{name}} |`, \"\", \"\",\n].join(\"\\n\");\n\n// The undertaker \u2014 same person in the infobox and the rolled text.\nlet main = null;\nif (has) { main = await rollUnique(); tR += infobox(main, \"Undertaker\", \"Keeps\"); }\n\nconst result = await api.rollUnscoped(\"TF-Undertaker\", { promptValues: {\n  town: \"{{town}}\", shopType: \"{{type}}\", shopName: \"{{name}}\",\n  keeperName: main?.name ?? \"\", keeperRace: main ? raceWord(main) : \"\",\n  keeperGender: main?.gender ?? \"\", keeperAge: main?.age ?? \"\",\n  keeperDesc: main ? descOf(main) : \"\"\n}});\ntR += result.result;\n\n// Record this note's faces so the next place in town skips them.\nif (_tfTownNote && _tfFresh.size) {\n  try {\n    await app.fileManager.processFrontMatter(_tfTownNote, (f) => {\n      const merged = Array.isArray(f.cast) ? f.cast.map(String) : [];\n      _tfFresh.forEach((n) => { if (merged.indexOf(n) < 0) merged.push(n); });\n      f.cast = merged;\n    });\n  } catch (e) { }\n}\n%>\n",
};

export const DEFAULT_SETTINGS = {
  scaleMultiplier: 1,
  distanceUnit: "miles",
  exportFolder: "Maps",
  templateFolder: "Templates/TownForge",
  pinTypes: DEFAULT_PIN_TYPES.map((t) => ({ ...t })),
  openAfterExport: true,
  groupNotesByType: true,
  enableZoomMapExport: false,
  showTroubleshoot: false
};
export const SIZE_BASE_DISTANCE = {
  hamlet: 1.5,
  village: 2.5,
  small_town: 4,
  town: 6,
  large_town: 9,
  small_city: 13,
  city: 18,
  large_city: 25,
  metropolis: 35
};
export const LANDSCAPE_BASE_DISTANCE = 10;
export const VALID_SETTLEMENTS = ["hamlet", "village", "small_town", "town", "large_town", "small_city", "city", "large_city", "metropolis"];
// Pull a `from: [[Note]]` (or `source: [[Note]]`) line out of a map block, so a
// block can draw a map from ANOTHER note's Properties. Returns { linkpath } or null.
export function extractSourceLink(source) {
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#"))
      continue;
    const idx = line.indexOf(":");
    if (idx === -1)
      continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (key === "from" || key === "source") {
      const val = line.slice(idx + 1).trim();
      const m = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/.exec(val);
      const linkpath = m ? m[1].trim() : val.replace(/^["']|["']$/g, "").trim();
      return { linkpath: linkpath || null };
    }
  }
  return null;
}
// Turn `townforge-<key>` / `townforge_<key>` note Properties into the same
// "key: value" lines parseConfig already understands. Lists become joined
// letters (edges: [N, E] -> "NE"); booleans become on/off (checkbox landmarks).
export function frontmatterToConfigLines(fm) {
  const lines = [];
  if (!fm || typeof fm !== "object")
    return lines;
  for (const rawKey of Object.keys(fm)) {
    const m = /^townforge[-_](.+)$/i.exec(rawKey);
    if (!m)
      continue;
    const key = m[1].trim().toLowerCase();
    if (!key)
      continue;
    let val = fm[rawKey];
    if (val === null || val === void 0)
      continue;
    if (Array.isArray(val))
      val = val.join("");
    else if (typeof val === "boolean")
      val = val ? "on" : "off";
    const text = String(val).trim();
    if (text)
      lines.push(`${key}: ${text}`);
  }
  return lines;
}
export function parseConfig(source) {
  const errors = [];
  const config: MapConfig = {
    terrain: "coastal",
    seed: "townforge",
    size: 512,
    roughness: 0.6,
    octaves: 5,
    mode: "landscape",
    settlement: "town",
    landmarks: {}
  };
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#"))
      continue;
    const idx = line.indexOf(":");
    if (idx === -1) {
      errors.push(`Ignored line (expected "key: value"): ${line}`);
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    switch (key) {
      case "terrain":
        if (VALID_TERRAINS.includes(value.toLowerCase())) {
          config.terrain = value.toLowerCase();
        } else {
          errors.push(`Unknown terrain "${value}" (use: ${VALID_TERRAINS.join(", ")})`);
        }
        break;
      case "seed":
        config.seed = value;
        break;
      case "size": {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 128 && n <= 2e3)
          config.size = n;
        else
          errors.push(`size must be 128\u20132000 (got "${value}")`);
        break;
      }
      case "roughness": {
        const r = parseFloat(value);
        if (!isNaN(r) && r >= 0 && r <= 1)
          config.roughness = r;
        else
          errors.push(`roughness must be 0\u20131 (got "${value}")`);
        break;
      }
      case "octaves": {
        const o = parseInt(value, 10);
        if (!isNaN(o) && o >= 1 && o <= 8)
          config.octaves = o;
        else
          errors.push(`octaves must be 1\u20138 (got "${value}")`);
        break;
      }
      case "mode": {
        const m = value.toLowerCase();
        if (m === "landscape" || m === "full")
          config.mode = m;
        else
          errors.push(`mode must be "landscape" or "full" (got "${value}")`);
        break;
      }
      case "settlement": {
        const s = value.toLowerCase();
        if (VALID_SETTLEMENTS.includes(s))
          config.settlement = s;
        else
          errors.push(`unknown settlement "${value}" (use: ${VALID_SETTLEMENTS.join(", ")})`);
        break;
      }
      case "scale": {
        const sc = parseFloat(value);
        if (!isNaN(sc) && sc > 0)
          config.scale = sc;
        else
          errors.push(`scale must be a positive number (got "${value}")`);
        break;
      }
      case "unit":
        config.unit = value;
        break;
      case "name":
        config.name = value;
        break;
      case "edges": {
        const v = value.toUpperCase();
        config.edges = { N: v.includes("N"), E: v.includes("E"), S: v.includes("S"), W: v.includes("W") };
        break;
      }
      case "farms": {
        const f = parseFloat(value);
        if (!isNaN(f) && f >= 0 && f <= 4)
          config.farms = f;
        else
          errors.push(`farms must be 0\u20134 (got "${value}")`);
        break;
      }
      case "forest": {
        const f = parseFloat(value);
        if (!isNaN(f) && f >= 0 && f <= 4)
          config.forest = f;
        else
          errors.push(`forest must be 0\u20134 (got "${value}")`);
        break;
      }
      case "seaside": {
        const v = value.toUpperCase();
        if (["N", "E", "S", "W"].includes(v))
          config.seaSide = v;
        else
          errors.push(`seaside must be N/E/S/W (got "${value}")`);
        break;
      }
      case "mtnside":
      case "mtnedges": {
        const v = value.toUpperCase().replace(/[^NESW]/g, "");
        const valid = ["N", "E", "S", "W"].filter((e) => v.includes(e)).join("");
        if (valid)
          config.mountainSide = valid;
        else
          errors.push(`${key} must contain N/E/S/W (got "${value}")`);
        break;
      }
      case "mtnsize":
      case "peaks": {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0 && n <= 12)
          config.peaks = n;
        else
          errors.push(`${key} must be 0\u201312 (got "${value}")`);
        break;
      }
      case "walls":
      case "castle":
      case "market":
      case "barracks":
      case "tower":
      case "temple": {
        const v = value.toLowerCase();
        const on = v === "on" || v === "true" || v === "yes";
        const off = v === "off" || v === "false" || v === "no";
        if (!on && !off) {
          errors.push(`${key} must be on/off (got "${value}")`);
          break;
        }
        const lmKey = key === "temple" ? "cathedral" : key;
        config.landmarks[lmKey] = on;
        break;
      }
      case "from":
      case "source":
        break;
      default:
        errors.push(`Unknown key "${key}"`);
    }
  }
  return { config, errors };
}
export const TownForgePlugin = class extends Plugin {
  // Declaration only, so the compiler knows the field exists and what shape it
  // has. Deliberately NOT called `settings` — Obsidian 1.13 put a `settings`
  // property on Plugin itself, which is what tripped the 1.2.0 review.
  tfSettings: TownForgeSettings;

  constructor(...args) {
    super(...args);
    this.tfSettings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerMarkdownCodeBlockProcessor(
      "town-forge",
      (source, el, ctx) => {
        this.renderBlock(source, el, ctx);
      }
    );
    this.registerView(TOWN_FORGE_VIEW, (leaf) => new TownForgePreviewView(leaf, () => this.tfSettings.exportFolder, () => this.tfSettings.templateFolder, () => this.tfSettings.pinTypes, () => this.tfSettings.openAfterExport, () => this.tfSettings.groupNotesByType, () => this.tfSettings.enableZoomMapExport, () => this.tfSettings.showTroubleshoot, () => this.tfSettings.scaleMultiplier, () => this.tfSettings.distanceUnit));
    this.addRibbonIcon("map", "Town Forge: open map preview", () => {
      void this.activatePreview();
    });
    this.addCommand({
      id: "open-town-forge-preview",
      name: "Open map preview panel",
      callback: () => this.activatePreview()
    });
    this.addSettingTab(new TownForgeSettingTab(this.app, this));
  }
  async loadSettings() {
    this.tfSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.tfSettings.pinTypes) || this.tfSettings.pinTypes.length === 0) {
      this.tfSettings.pinTypes = DEFAULT_PIN_TYPES.map((t) => ({ ...t }));
    } else {
      const have = new Set(this.tfSettings.pinTypes.map((t) => t.id));
      for (const def of DEFAULT_PIN_TYPES) {
        if (!have.has(def.id))
          this.tfSettings.pinTypes.push({ ...def });
      }
      const tower = this.tfSettings.pinTypes.find((t) => t.id === "tower");
      if (tower && (tower.icon === "tower" || tower.icon === "tower-observation")) {
        tower.icon = "pinRed";
      }
    }
  }
  /**
   * Write the bundled place templates into the configured template
   * folder (create when missing, overwrite when present - the bundle
   * is the source of truth; keep customised copies under different
   * names). Returns { created, updated }.
   */
  // Add the template folder to Templater's excluded-folders list so Templater's
  // "trigger on new file creation" doesn't execute the template files as we write
  // them (which would prompt for town/size and could overwrite the templates).
  // Stamped place notes live in the export folder, which stays un-excluded.
  ensureTemplaterIgnores(folder) {
    try {
      const reg = this.app.plugins && this.app.plugins.plugins ? this.app.plugins.plugins : null;
      const tp = reg ? reg["templater-obsidian"] : null;
      if (!tp || !tp.settings || !Array.isArray(tp.settings.ignore_folders_on_creation))
        return false;
      const norm = String(folder).replace(/\/+$/, "");
      const has = tp.settings.ignore_folders_on_creation.some(
        (e) => e && typeof e.folder === "string" && e.folder.replace(/\/+$/, "") === norm
      );
      if (has)
        return false;
      tp.settings.ignore_folders_on_creation.push({ folder: norm });
      if (typeof tp.save_settings === "function")
        tp.save_settings();
      else if (typeof tp.saveSettings === "function")
        tp.saveSettings();
      return true;
    } catch {
      return false;
    }
  }
  async seedPlaceTemplates() {
    const folder = this.tfSettings.templateFolder || "Templates/TownForge";
    const excluded = this.ensureTemplaterIgnores(folder);
    const vault = this.app.vault;
    if (!vault.getAbstractFileByPath(folder)) {
      try {
        await vault.createFolder(folder);
      } catch {
        // Ignored: the folder already exists — nothing to do.
      }
    }
    let created = 0, updated = 0;
    for (const [name, content] of Object.entries(TOWN_FORGE_TEMPLATES)) {
      const path = `${folder}/${name}`;
      const existing = vault.getAbstractFileByPath(path);
      if (existing) {
        await vault.modify(existing, content);
        updated++;
      } else {
        await vault.create(path, content);
        created++;
      }
    }
    return { created, updated, excluded };
  }
  async saveSettings() {
    await this.saveData(this.tfSettings);
  }
  onunload() {
  }
  // Rebuild any open Town Forge panels so settings changes (which buttons show,
  // etc.) take effect immediately without reopening the view.
  refreshOpenPanels() {
    for (const leaf of this.app.workspace.getLeavesOfType(TOWN_FORGE_VIEW)) {
      const view = leaf.view;
      if (view && typeof view.rebuild === "function")
        view.rebuild();
    }
  }
  async activatePreview() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(TOWN_FORGE_VIEW);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: TOWN_FORGE_VIEW, active: true });
      await workspace.revealLeaf(leaf);
    }
  }
  // Merge note Properties into a map block. Base layer comes from frontmatter -
  // either the note the block sits in, or, if the block has `from: [[Note]]`,
  // that other note. Explicit lines in the block always win over Properties.
  applyPropertyConfig(source, ctx) {
    const extraErrors = [];
    const app = this.app;
    let fm = null;
    const link = extractSourceLink(source);
    if (link && link.linkpath) {
      const dest = app.metadataCache ? app.metadataCache.getFirstLinkpathDest(link.linkpath, ctx && ctx.sourcePath ? ctx.sourcePath : "") : null;
      if (dest) {
        const cache = app.metadataCache.getFileCache(dest);
        fm = cache && cache.frontmatter ? cache.frontmatter : null;
        if (!fm)
          extraErrors.push(`from [[${link.linkpath}]]: that note has no Properties yet`);
      } else {
        extraErrors.push(`from [[${link.linkpath}]]: note not found`);
      }
    } else {
      fm = ctx && ctx.frontmatter ? ctx.frontmatter : null;
      if (!fm && ctx && ctx.sourcePath && app.vault) {
        const self = app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (self && app.metadataCache) {
          const cache = app.metadataCache.getFileCache(self);
          fm = cache && cache.frontmatter ? cache.frontmatter : null;
        }
      }
    }
    const fmLines = frontmatterToConfigLines(fm);
    const merged = fmLines.length ? fmLines.join("\n") + "\n" + source : source;
    return { source: merged, errors: extraErrors };
  }
  renderBlock(source, el, ctx) {
    const applied = this.applyPropertyConfig(source, ctx);
    const { config, errors } = parseConfig(applied.source);
    for (const m of applied.errors)
      errors.push(m);
    const wrap = el.createDiv({ cls: "town-forge-map tf-s-map-wrap" });
    try {
      const opts = {
        roughness: config.roughness,
        octaves: config.octaves,
        riverWidth: 0.06,
        lakeSize: 0.3,
        rangeLen: 0.65,
        peakCount: config.peaks ?? 6,
        seaSide: config.seaSide,
        mountainSide: config.mountainSide
      };
      const fullMode = config.mode === "full";
      const genSize = fullMode ? MAP_SIZE_BY_SIZE[config.settlement] ?? 1e3 : config.size;
      const canvas = wrap.createEl("canvas", { cls: "tf-s-map-canvas" });
      canvas.width = genSize;
      canvas.height = genSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        wrap.createDiv({ text: "Town Forge: could not get a 2D canvas context." });
        return;
      }
      const baseDist = fullMode ? SIZE_BASE_DISTANCE[config.settlement] ?? LANDSCAPE_BASE_DISTANCE : LANDSCAPE_BASE_DISTANCE;
      const mapDistance = config.scale ?? baseDist * this.tfSettings.scaleMultiplier;
      const distanceUnit = config.unit ?? this.tfSettings.distanceUnit;
      let captionText;
      if (fullMode) {
        const full = generateFull(config.terrain, config.seed, {
          ...opts,
          mode: "full",
          size: config.settlement,
          showForest: true,
          showRoads: true,
          enabledEdges: config.edges,
          overrides: {
            ...config.landmarks,
            farmDensity: config.farms,
            forestDensity: config.forest
          }
        });
        renderFull(ctx, full, genSize, genSize, config.terrain, mapDistance, distanceUnit, config.name);
        captionText = `${config.name ? config.name + " \xB7 " : ""}${config.terrain} \xB7 ${config.settlement} \xB7 seed "${config.seed}"`;
      } else {
        const scene = generateLandscape(config.terrain, config.seed, genSize, genSize, opts);
        renderScene(ctx, scene, genSize, genSize, config.terrain, mapDistance, distanceUnit);
        captionText = `${config.name ? config.name + " \xB7 " : ""}${config.terrain} \xB7 seed "${config.seed}"`;
      }
      const caption = wrap.createDiv({ cls: "town-forge-caption tf-s-map-caption" });
      caption.setText(captionText);
    } catch (e) {
      const err = wrap.createDiv({ cls: "town-forge-error tf-s-map-error" });
      err.setText(`Town Forge error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (errors.length) {
      const warn = wrap.createDiv({ cls: "town-forge-warn tf-s-map-warn" });
      warn.setText("Config notes: " + errors.join("; "));
    }
  }
};
export const TownForgeSettingTab = class extends PluginSettingTab {
  plugin: InstanceType<typeof TownForgePlugin>;

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "Town Forge \u2014 map scale" });
    new Setting(containerEl).setName("Distance unit").setDesc('Free text shown on the scale bar \u2014 e.g. "miles", "km", or "lengths of string".').addText(
      (text) => text.setPlaceholder("miles").setValue(this.plugin.tfSettings.distanceUnit).onChange(async (value) => {
        this.plugin.tfSettings.distanceUnit = value.trim() || "miles";
        await this.plugin.saveSettings();
      })
    );
    new Setting(containerEl).setName("Scale multiplier").setDesc("Scales all map distances up or down together. 1.0 = defaults (a metropolis map \u2248 35 of your units across, a hamlet \u2248 1.5). Use 2 for a larger world, 0.5 for a smaller one. A single map block can override the distance entirely with a `scale:` line.").addText(
      (text) => text.setPlaceholder("1.0").setValue(String(this.plugin.tfSettings.scaleMultiplier)).onChange(async (value) => {
        const n = parseFloat(value);
        if (!isNaN(n) && n > 0) {
          this.plugin.tfSettings.scaleMultiplier = n;
          await this.plugin.saveSettings();
        }
      })
    );
    containerEl.createEl("h3", { text: "Town Forge \u2014 export" });
    new Setting(containerEl).setName("Enable TTRPG Tools: Maps export").setDesc('Turn on the "Export to TTRPG Tools: Maps" button and its options (pin types, templates, per-type note folders). Requires the community plugin "TTRPG Tools: Maps" (formerly Zoom Map). Off by default.').addToggle(
      (toggle) => toggle.setValue(this.plugin.tfSettings.enableZoomMapExport).onChange(async (value) => {
        this.plugin.tfSettings.enableZoomMapExport = value;
        await this.plugin.saveSettings();
        this.plugin.refreshOpenPanels();
        this.display();
      })
    );
    const linkSetting = new Setting(containerEl).setName("Get TTRPG Tools: Maps").setDesc("The Obsidian community plugin that renders the exported maps and pins. Opens its install page.");
    linkSetting.addButton(
      (b) => b.setButtonText("Open plugin page").setCta().onClick(() => {
        window.open("obsidian://show-plugin?id=zoom-map");
      })
    );
    if (this.plugin.tfSettings.enableZoomMapExport) {
      new Setting(containerEl).setName("Export folder").setDesc('Vault folder that "Export to TTRPG Tools: Maps" writes into. Each export creates a subfolder named after the map, holding the PNG and a note with a zoommap code block. Use a vault-relative path like "Maps" or "Atlas/Cities".').addText(
        (text) => text.setPlaceholder("Maps").setValue(this.plugin.tfSettings.exportFolder).onChange(async (value) => {
          this.plugin.tfSettings.exportFolder = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || "Maps";
          await this.plugin.saveSettings();
        })
      );
      new Setting(containerEl).setName("Template folder").setDesc(`Vault folder holding per-building-type template notes (e.g. "Shop.md"). When a place is pinned, the matching template is copied into the map folder as that place's note, with {{name}}, {{type}}, {{subtype}} and {{town}} filled in. Leave Randomness/Templater syntax in the template \u2014 it resolves when you open the note. If no template exists for a type, a simple default note is written.`).addText(
        (text) => text.setPlaceholder("Templates/TownForge").setValue(this.plugin.tfSettings.templateFolder).onChange(async (value) => {
          this.plugin.tfSettings.templateFolder = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || "Templates/TownForge";
          await this.plugin.saveSettings();
        })
      );
      new Setting(containerEl).setName("Pre-made map content").setDesc("Install the items below to add pre-made templates built to work together with Town Forge, TTRPG Tools - Maps, Randomness, Heraldry Weaver and more \u2014 giving you 1-click maps that self-populate with places, people, items and adventure hooks. Step 1: write the place-note templates. Step 2: send their pin icons to TTRPG Tools - Maps.").setHeading();
      let _tfCreateBtn = null;
      new Setting(containerEl).setName("Create place templates").setDesc('Writes the ready-made place notes (Shop, Inn, Tavern, Castle, Temple and more) into the template folder above. When a place is pinned, the matching note fills itself in with a rolled name, keeper and NPCs. First get the checklist below all green - without the Randomness generators the notes come out blank. Safe to click again after updates; it only overwrites these 15 names.').addExtraButton(
        (b) => b.setIcon("dice").setTooltip("Get Randomness (rolls the content + portraits)").onClick(() => {
          window.open("obsidian://show-plugin?id=randomness");
        })
      ).addExtraButton(
        (b) => b.setIcon("scroll").setTooltip("Get Templater (runs the templates - enable its 'Trigger on new file creation')").onClick(() => {
          window.open("obsidian://show-plugin?id=templater-obsidian");
        })
      ).addExtraButton(
        (b) => b.setIcon("shield").setTooltip("Get Heraldry Weaver (crests on castles and guilds)").onClick(() => {
          window.open("obsidian://show-plugin?id=heraldry-weaver");
        })
      ).addExtraButton(
        (b) => b.setIcon("palette").setTooltip("Get the ITS theme (styles the NPC infoboxes)").onClick(() => {
          window.open("obsidian://show-theme?name=ITS%20Theme");
        })
      ).addButton(
        (b) => {
          _tfCreateBtn = b;
          b.setButtonText("Create / update").setCta().onClick(async () => {
            try {
              const r = await this.plugin.seedPlaceTemplates();
              new Notice(`Town Forge: templates ready in "${this.plugin.tfSettings.templateFolder}" (${r.created} created, ${r.updated} updated).` + (r.excluded ? " Added it to Templater's excluded folders so Templater won't auto-run the templates." : ""), r.excluded ? 9000 : 4000);
            } catch (e) {
              new Notice("Town Forge: template creation failed - " + (e && e.message ? e.message : String(e)), 8000);
            }
          });
        }
      );
      const _tfSteps = containerEl.createDiv({ cls: "setting-item-description tf-s-steps" });
      _tfSteps.setText("Checking set-up…");
      void (async () => {
        const app2 = this.app || this.plugin.app;
        const registry = app2.plugins && app2.plugins.plugins ? app2.plugins.plugins : {};
        // Step 1 - Randomness enabled with a usable API.
        const rnd = registry["randomness"] || null;
        const api = rnd && rnd.api ? rnd.api : null;
        // Step 5 - Fantasy Hub generators present. TF-Inn is a reliable sentinel;
        // api.tables() uses the same vault discovery the templates roll through.
        let hubReady = false, canDetect = !!(api && typeof api.tables === "function");
        if (canDetect) {
          try {
            const names = await api.tables();
            hubReady = new Set(names.map((n) => String(n).toLowerCase())).has("tf-inn");
          } catch { canDetect = false; }
        }
        // Step 4 - portrait pack (adds NPC faces; templates degrade gracefully without it).
        let portraitsReady = false;
        try { portraitsReady = !!(api && api.portraits && await api.portraits.available()); } catch { portraitsReady = false; }
        // Step 3 - Heraldry Weaver. The castle and guild templates carry a
        // heraldry-seed and render `heraldry:` inline / ```heraldry blocks; without
        // the plugin enabled those stay as literal code and no crest is drawn.
        const hw = registry["heraldry-weaver"] || null;
        const hwInstalled = !!(app2.plugins && app2.plugins.manifests && app2.plugins.manifests["heraldry-weaver"]);
        // Step 2 - Templater installed with trigger-on-create ON. The toggle is a
        // device-local setting (app.loadLocalStorage "templater-local-settings"),
        // NOT in tp.settings; older Templater kept it in tp.settings, so check both.
        const tp = registry["templater-obsidian"] || null;
        let tpTrigger = void 0;
        try {
          const tpLocal = typeof app2.loadLocalStorage === "function" ? app2.loadLocalStorage("templater-local-settings") : null;
          if (tpLocal && typeof tpLocal.trigger_on_file_creation === "boolean") tpTrigger = tpLocal.trigger_on_file_creation;
          else if (tp && tp.settings && typeof tp.settings.trigger_on_file_creation === "boolean") tpTrigger = tp.settings.trigger_on_file_creation;
        } catch { tpTrigger = void 0; }

        _tfSteps.empty();
        _tfSteps.createDiv({ text: "Set-up checklist - do these in order:", cls: "tf-s-steps-head" });
        const row = (state, text) => {
          const mark = state === true ? "✅" : state === "warn" ? "⚠️" : "❌";
          const d = _tfSteps.createDiv({ text: `${mark} ${text}`, cls: "tf-s-steps-row" });
          return d;
        };

        row(!!api, api
          ? "Step 1 - Randomness plugin installed & on"
          : "Step 1 - install & enable the Randomness plugin (dice button on the right)");

        if (!tp) row(false, "Step 2 - install & enable Templater (scroll button on the right)");
        else if (tpTrigger === true) row(true, "Step 2 - Templater set to run on new files");
        else if (tpTrigger === false) row(false, "Step 2 - in Templater settings, turn ON “Trigger Templater on new file creation”");
        else row("warn", "Step 2 - make sure Templater’s “Trigger on new file creation” is ON");

        if (hw) row(true, "Step 3 - Heraldry Weaver plugin installed & on");
        else if (hwInstalled) row(false, "Step 3 - enable the Heraldry Weaver plugin (the castle and guild templates draw their crests with it)");
        else row(false, "Step 3 - install & enable Heraldry Weaver (shield button on the right; draws the castle and guild crests)");

        row(portraitsReady ? true : "warn", portraitsReady
          ? "Step 4 - Fantasy Portrait Pack installed"
          : "Step 4 - in Randomness settings, click “Install Fantasy Portrait Pack” (needed for Step 5; adds NPC faces)");

        if (canDetect) row(hubReady, hubReady
          ? "Step 5 - Fantasy Hub content installed, place generators ready"
          : "Step 5 - in Randomness settings, click “Install Fantasy Hub content” (do Step 4 first)");
        else row("warn", "Step 5 - in Randomness settings, click “Install Fantasy Hub content” (couldn’t auto-check - older Randomness)");

        const ready = canDetect ? hubReady : !!api;
        if (_tfCreateBtn) {
          _tfCreateBtn.setDisabled(!ready);
          _tfCreateBtn.setButtonText(ready ? "Create / update" : "Create / update - finish the checklist");
        }
        _tfSteps.createDiv({ text: ready
          ? "✅ All set - click Create / update, then generate a map and the places fill themselves in."
          : "⚠️ Finish the red steps first. The button switches on once the Fantasy Hub generators are found.", cls: "tf-s-steps-foot" });
      })();
            (() => {
        let _app = this.app || this.plugin.app;
        let _mani = _app.plugins && _app.plugins.manifests ? _app.plugins.manifests["zoom-map"] : null;
        if (!_mani) return;
        new Setting(containerEl).setName("Send pin icons to TTRPG Tools - Maps").setDesc('Detected TTRPG Tools - Maps ("' + (_mani.name || "Zoom Map") + '"). Write Town Forge\'s pin icons into its icon library so each pin shows its icon on the map. Safe to click again - it only adds or updates these icons and leaves your others alone.').addButton(
          (b) => b.setButtonText("Send icons").setCta().onClick(async () => {
            try {
              let app2 = this.app || this.plugin.app;
              let zm = app2.plugins.plugins["zoom-map"];
              if (!zm) { new Notice("TTRPG Tools - Maps is installed but not enabled - enable it first.", 7000); return; }
              if (!Array.isArray(zm.settings.icons)) zm.settings.icons = [];
              let byKey = new Map(zm.settings.icons.map((i) => [i.key, i]));
              let added = 0, updated = 0;
              for (let k = 0; k < TF_ICON_LIBRARY.length; k++) {
                let ic = TF_ICON_LIBRARY[k];
                if (byKey.has(ic.key)) updated++; else added++;
                byKey.set(ic.key, ic);
              }
              zm.settings.icons = Array.from(byKey.values());
              await zm.saveSettings();
              new Notice("Town Forge: sent " + TF_ICON_LIBRARY.length + " pin icons to TTRPG Tools - Maps (" + added + " added, " + updated + " updated).");
            } catch (e) {
              new Notice("Town Forge: sending icons failed - " + (e && e.message ? e.message : String(e)), 8000);
            }
          })
        );
      })();
      new Setting(containerEl).setName("Export options").setHeading();
      new Setting(containerEl).setName("Open note after export").setDesc("After exporting, open the generated map note in the active pane.").addToggle(
        (toggle) => toggle.setValue(this.plugin.tfSettings.openAfterExport).onChange(async (value) => {
          this.plugin.tfSettings.openAfterExport = value;
          await this.plugin.saveSettings();
        })
      );
      new Setting(containerEl).setName("Group place notes by type").setDesc("Write each place note into a per-type subfolder inside the map folder (e.g. Steadwick/Shop/, Steadwick/Inn/) instead of all in one flat folder. The map note and image stay at the map-folder root, and pin links keep working.").addToggle(
        (toggle) => toggle.setValue(this.plugin.tfSettings.groupNotesByType).onChange(async (value) => {
          this.plugin.tfSettings.groupNotesByType = value;
          await this.plugin.saveSettings();
        })
      );
      this.renderPinTypes(containerEl);
    }
    containerEl.createEl("h3", { text: "Town Forge \u2014 panel" });
    new Setting(containerEl).setName("Show troubleshooting button").setDesc('Show the "\u{1F41E} Copy config for support" button in the Town Forge panel. Handy for bug reports. Off by default.').addToggle(
      (toggle) => toggle.setValue(this.plugin.tfSettings.showTroubleshoot).onChange(async (value) => {
        this.plugin.tfSettings.showTroubleshoot = value;
        await this.plugin.saveSettings();
        this.plugin.refreshOpenPanels();
      })
    );
  }
  // ---- Pin types editor (hybrid: structured rows + JSON advanced) ----------
  renderPinTypes(containerEl) {
    containerEl.createEl("h3", { text: "Town Forge \u2014 pin types" });
    containerEl.createEl("p", {
      text: "Each pin type places markers on the map and writes a note per place. Anchored types pin a real structure (castle, dock\u2026); sampled types scatter over houses (shops, inns\u2026). Counts are a random range; \u201Cscaled\u201D counts grow with settlement size. Names use built-in word lists by default, or a custom JS hook for power users.",
      cls: "setting-item-description"
    });
    const rowsHost = containerEl.createDiv();
    const redraw = () => {
      rowsHost.empty();
      this.plugin.tfSettings.pinTypes.forEach((t, i) => this.renderPinTypeRow(rowsHost, t, i, redraw));
    };
    redraw();
    new Setting(containerEl).addButton((b) => b.setButtonText("Add pin type").onClick(async () => {
      this.plugin.tfSettings.pinTypes.push(newCustomPinType());
      await this.plugin.saveSettings();
      redraw();
    })).addButton((b) => b.setButtonText("Reset to defaults").setWarning().onClick(async () => {
      this.plugin.tfSettings.pinTypes = DEFAULT_PIN_TYPES.map((t) => ({ ...t }));
      await this.plugin.saveSettings();
      redraw();
      this.display();
    }));
    this.renderBuildingKey(containerEl);
    const details = containerEl.createEl("details");
    details.createEl("summary", { text: "Advanced: edit pin types as JSON" });
    details.createEl("p", { text: "Power users: edit the full config here (and write custom JS name hooks). In a hook, these are in scope: app, api (Randomness if installed), seed, town, type, index \u2014 return a string. Example: return (await api.rollUnscoped('ShopName')).result", cls: "setting-item-description" });
    const ta = details.createEl("textarea", { cls: "tf-s-json-editor" });
    ta.value = pinTypesToJson(this.plugin.tfSettings.pinTypes);
    const status = details.createDiv({ cls: "setting-item-description" });
    const applyBtn = details.createEl("button", { text: "Apply JSON" });
    applyBtn.onclick = async () => {
      const { types, error } = parsePinTypesJson(ta.value);
      if (error || !types) {
        status.setText(`\u26A0 ${error ?? "Parse failed"}`);
        status.toggleClass("tf-s-status-success", false);
        status.toggleClass("tf-s-status-error", true);
        return;
      }
      this.plugin.tfSettings.pinTypes = types;
      await this.plugin.saveSettings();
      status.setText(`\u2713 Applied ${types.length} pin types`);
      status.toggleClass("tf-s-status-error", false);
      status.toggleClass("tf-s-status-success", true);
      redraw();
    };
  }
  // Collapsible visual key: each drawn building, what it is, and the template
  // the anchoring pin type requests.
  renderBuildingKey(containerEl) {
    const details = containerEl.createEl("details", { cls: "tf-s-key-details" });
    details.createEl("summary", { text: "Building key \u2014 what each map building is", cls: "tf-s-key-summary" });
    details.createEl("p", {
      text: "These are the buildings Town Forge draws on the map. Each row shows the building, what anchors to it, and the template note its pin type requests (named after the note type). Sampled types (shops, etc.) have no unique building \u2014 they sit on ordinary houses.",
      cls: "setting-item-description"
    });
    const byAnchor = /* @__PURE__ */ new Map();
    for (const t of this.plugin.tfSettings.pinTypes) {
      if (!t.enabled)
        continue;
      if ((t.placement === "anchored" || t.placement === "both") && t.anchor && !byAnchor.has(t.anchor)) {
        byAnchor.set(t.anchor, t);
      }
    }
    const grid = details.createDiv({ cls: "tf-s-key-grid" });
    for (const entry of BUILDING_KEY) {
      const card = grid.createDiv({ cls: "tf-s-key-card" });
      const img = card.createEl("img", { cls: "tf-s-key-img" });
      img.src = BUILDING_IMAGES[entry.key] ?? "";
      card.createEl("strong", { text: entry.label, cls: "tf-s-key-title" });
      card.createSpan({ text: entry.note, cls: "tf-s-key-desc" });
      const pin = entry.anchor ? byAnchor.get(entry.anchor) : null;
      const mapping = card.createSpan({ cls: "tf-s-key-mapping" });
      if (entry.anchor && pin) {
        mapping.setText(`\u2192 ${pin.noteType} \xB7 template: ${pin.noteType}.md`);
      } else if (entry.anchor && !pin) {
        mapping.setText("\u2192 no enabled pin type");
        mapping.addClass("tf-s-key-mapping-dim");
      } else {
        mapping.setText("\u2192 used by sampled types (shops, inns\u2026)");
        mapping.addClass("tf-s-key-mapping-dim");
      }
    }
  }
  renderPinTypeRow(host, t, index, redraw) {
    const save = async () => {
      await this.plugin.saveSettings();
    };
    const card = host.createDiv({ cls: "tf-s-pin-card" });
    const header = card.createDiv({ cls: "tf-s-pin-header" });
    const enable = header.createEl("input", { type: "checkbox" });
    enable.checked = t.enabled;
    enable.title = "Enabled";
    enable.onchange = async () => {
      t.enabled = enable.checked;
      await save();
    };
    const heading = header.createEl("strong", { text: t.noteType || "(unnamed)", cls: "tf-s-pin-heading" });
    const badge = header.createSpan({ text: t.placement, cls: "tf-s-pin-badge" });
    const del = header.createEl("button", { text: "Remove", cls: "tf-s-pin-remove" });
    del.onclick = async () => {
      this.plugin.tfSettings.pinTypes.splice(index, 1);
      await save();
      redraw();
    };
    const grid = card.createDiv({ cls: "tf-s-pin-grid" });
    const field = (label, widthEm) => {
      const wrap = grid.createDiv({ cls: "tf-s-pin-field" });
      wrap.setCssStyles({ minWidth: `${widthEm}em` });
      wrap.createEl("label", { text: label, cls: "tf-s-pin-field-label" });
      return wrap;
    };
    const noteTypeWrap = field("Note type", 9);
    const noteTypeInput = noteTypeWrap.createEl("input", { type: "text", value: t.noteType, cls: "tf-s-full-width" });
    noteTypeInput.onchange = async () => {
      t.noteType = noteTypeInput.value.trim() || t.noteType;
      heading.setText(t.noteType);
      await save();
    };
    const iconWrap = field("Pin icon (Zoom Map key)", 11);
    const iconInput = iconWrap.createEl("input", { type: "text", value: t.icon, cls: "tf-s-full-width" });
    iconInput.onchange = async () => {
      t.icon = iconInput.value.trim() || t.icon;
      await save();
    };
    const layerWrap = field("Layer", 9);
    const layerInput = layerWrap.createEl("input", { type: "text", value: t.layerName, cls: "tf-s-full-width" });
    layerInput.onchange = async () => {
      t.layerName = layerInput.value.trim() || t.layerName;
      await save();
    };
    const minWrap = field("Min", 4);
    const minInput = minWrap.createEl("input", { type: "number", value: String(t.countMin), cls: "tf-s-full-width" });
    minInput.onchange = async () => {
      t.countMin = Math.max(0, parseInt(minInput.value) || 0);
      await save();
    };
    const maxWrap = field("Max", 4);
    const maxInput = maxWrap.createEl("input", { type: "number", value: String(t.countMax), cls: "tf-s-full-width" });
    maxInput.onchange = async () => {
      t.countMax = Math.max(t.countMin, parseInt(maxInput.value) || t.countMin);
      await save();
    };
    const modeWrap = field("Count mode", 7);
    const modeSel = modeWrap.createEl("select", { cls: "tf-s-full-width" });
    for (const m of ["scaled", "fixed"]) {
      const o = modeSel.createEl("option", { text: m, value: m });
      if (t.countMode === m)
        o.selected = true;
    }
    modeSel.onchange = async () => {
      t.countMode = modeSel.value;
      await save();
    };
    const placeWrap = field("Placement", 8);
    const placeSel = placeWrap.createEl("select", { cls: "tf-s-full-width" });
    for (const p of ["sampled", "anchored", "both"]) {
      const o = placeSel.createEl("option", { text: p, value: p });
      if (t.placement === p)
        o.selected = true;
    }
    placeSel.onchange = async () => {
      t.placement = placeSel.value;
      badge.setText(t.placement);
      await save();
      redraw();
    };
    if (t.placement === "anchored" || t.placement === "both") {
      const anchorWrap = field("Anchor (real structure)", 10);
      const anchorSel = anchorWrap.createEl("select", { cls: "tf-s-full-width" });
      const anchors = ["castle", "cathedral", "market", "barracks", "dock", "mill", "stable", "inn", "tower", "generic", "farm"];
      for (const a of anchors) {
        const o = anchorSel.createEl("option", { text: a, value: a });
        if (t.anchor === a)
          o.selected = true;
      }
      if (!t.anchor)
        anchorSel.selectedIndex = 0;
      anchorSel.onchange = async () => {
        t.anchor = anchorSel.value;
        await save();
      };
    }
    const nameWrap = field("Naming", 8);
    const nameSel = nameWrap.createEl("select", { cls: "tf-s-full-width" });
    for (const nm of [["builtin", "built-in"], ["js", "custom JS"]]) {
      const o = nameSel.createEl("option", { text: nm[1], value: nm[0] });
      if (t.nameMode === nm[0])
        o.selected = true;
    }
    nameSel.onchange = async () => {
      t.nameMode = nameSel.value;
      await save();
      redraw();
    };
    if (t.nameMode === "js") {
      const jsWrap = card.createDiv({ cls: "tf-s-pin-subsection" });
      jsWrap.createEl("label", { text: "Name JS \u2014 in scope: app, api, seed, town, type, index, subtypes \u2014 return a string, or { name, subtype } to set both", cls: "tf-s-pin-block-label" });
      const ta = jsWrap.createEl("textarea", { cls: "tf-s-pin-js-editor" });
      ta.value = t.nameJs ?? "";
      ta.placeholder = `const [subtype, name] = (await api.rollUnscoped("TF-ShopPick")).result.split("|");
return { name, subtype };`;
      ta.onchange = async () => {
        t.nameJs = ta.value;
        await save();
      };
    }
    const subWrap = card.createDiv({ cls: "tf-s-pin-subsection" });
    subWrap.createEl("label", { text: "Subtypes (comma-separated) \u2014 written to frontmatter as subtype:. The JS hook returning { name, subtype } keeps name+subtype correlated; the built-in picks from this list but does not guarantee a match.", cls: "tf-s-pin-block-label" });
    const subIn = subWrap.createEl("input", { type: "text", cls: "tf-s-pin-sub-input" });
    subIn.value = (t.subtypes ?? []).join(", ");
    subIn.placeholder = "e.g. general, weapon, armor, alchemy, magic";
    subIn.onchange = async () => {
      const arr = subIn.value.split(",").map((s) => s.trim()).filter((s) => s.length);
      t.subtypes = arr.length ? arr : void 0;
      await save();
    };
  }
};

export default TownForgePlugin;
