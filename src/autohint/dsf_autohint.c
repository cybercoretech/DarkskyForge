/* DarkskyForge wrapper around the ttfautohint library (FreeType License).
 * Hints a TrueType font held in memory. Returns the hinted length (> 0) and
 * stores the malloc'd buffer in *out, or returns -(TA_Error) on failure, with
 * the library's message available from dsf_last_error(). */
#include <stdlib.h>
#include "ttfautohint.h"

static const unsigned char *last_error;

const char *dsf_last_error(void) { return last_error ? (const char *)last_error : ""; }

int dsf_autohint(const char *in, size_t in_len, char **out,
                 int range_min, int range_max, int limit, int x_height, int symbol)
{
  size_t out_len = 0;
  last_error = NULL;
  *out = NULL;
  TA_Error error = TTF_autohint(
    "in-buffer, in-buffer-len, out-buffer, out-buffer-len, error-string,"
    " hinting-range-min, hinting-range-max, hinting-limit,"
    " increase-x-height, symbol",
    in, in_len, out, &out_len, &last_error,
    range_min, range_max, limit, x_height, symbol);
  if (error) { if (*out) { free(*out); *out = NULL; } return -(int)error; }
  return (int)out_len;
}
