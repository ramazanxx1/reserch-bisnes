export async function GET(){return Response.json({overpassUrl:process.env.OVERPASS_URL||'https://maps.mail.ru/osm/tools/overpass/api/interpreter'},{headers:{'Cache-Control':'no-store'}});}
